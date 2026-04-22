use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, Path, State},
    response::IntoResponse,
};
use futures::{sink::SinkExt, stream::StreamExt};
use crate::state::lobby::{AppState, PokerTable};
use crate::network::messages::{ClientMessage, ServerMessage, WinnerInfo};

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(table_id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, table_id, state))
}

/// Construit un GameStateUpdate complet depuis l'état courant de la table.
fn build_state_update(table: &PokerTable) -> ServerMessage {
    let mut players_info = Vec::new();
    let mut hole_cards_map = std::collections::HashMap::new();

    for p in &table.game.players {
        players_info.push(crate::network::messages::PlayerInfo {
            pseudo: p.pseudo.clone(),
            chips: p.chips,
            current_bet: p.current_bet,
            has_folded: p.has_folded,
            current_hand: Some("Analyse en cours...".to_string()),
            seat: p.seat,
        });
        if let Some(cards) = &p.hole_cards {
            hole_cards_map.insert(
                p.pseudo.clone(),
                vec![cards[0].to_string(), cards[1].to_string()],
            );
        }
    }

    let current_turn_pseudo = if table.game.players.is_empty() {
        None
    } else {
        // Borne le current_player_index pour éviter le panic
        let idx = table.game.current_player_index.min(table.game.players.len() - 1);
        Some(table.game.players[idx].pseudo.clone())
    };

    let winners: Vec<WinnerInfo> = table.game.winners.iter().map(|w| WinnerInfo {
        pseudo: w.pseudo.clone(),
        amount_won: w.amount_won,
    }).collect();

    ServerMessage::GameStateUpdate {
        phase: format!("{:?}", table.game.phase),
        pot: table.game.pot,
        community_cards: table.game.community_cards.iter().map(|c| c.to_string()).collect(),
        current_turn_pseudo,
        players: players_info,
        hole_cards: hole_cards_map,
        winners,
    }
}

async fn handle_socket(socket: WebSocket, table_id: String, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    
    // Obtenir le premier message avec le pseudo
    let first_msg = receiver.next().await;
    let player_id = match first_msg {
        Some(Ok(Message::Text(text))) => {
            match serde_json::from_str::<ClientMessage>(&text) {
                Ok(ClientMessage::JoinTable { pseudo }) => pseudo,
                _ => {
                    println!("🔴 Premier message invalide, déconnexion");
                    return;
                }
            }
        }
        _ => {
            println!("🔴 Aucun message reçu, déconnexion");
            return;
        }
    };

    println!("🟢 NOUVELLE CONNEXION : {} rejoint la table {}", player_id, table_id);

    let player_seat = {
        let mut state_guard = state.lock().unwrap();
        let table = state_guard.entry(table_id.clone()).or_insert_with(PokerTable::new);
        table.game.add_player(player_id.clone(), 1000);
        
        // Récupérer le siège assigné
        table.game.players.iter()
            .find(|p| p.pseudo == player_id)
            .map(|p| p.seat)
            .unwrap_or(0)
    };

    let welcome_msg = serde_json::to_string(&ServerMessage::Welcome { pseudo: player_id.clone(), seat: player_seat }).unwrap();
    let _ = sender.send(Message::Text(welcome_msg)).await;

    let mut rx = {
        let mut state_guard = state.lock().unwrap();
        let table = state_guard.get_mut(&table_id).unwrap();

        let rx = table.tx.subscribe();
        let update = build_state_update(table);
        let _ = table.tx.send(update);
        rx
    };

    let mut send_task = tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(msg) => {
                    let json_msg = serde_json::to_string(&msg).unwrap();
                    if sender.send(Message::Text(json_msg)).await.is_err() {
                        break; // Client déconnecté
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                    // On a raté des messages (trop lents), on continue
                    continue;
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                    // Le channel est fermé (table supprimée), on sort
                    break;
                }
            }
        }
    });

    let state_for_recv = state.clone();
    let table_id_for_recv = table_id.clone();
    let player_id_for_recv = player_id.clone();

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(Message::Text(text))) = receiver.next().await {
            if let Ok(client_action) = serde_json::from_str::<ClientMessage>(&text) {
                let mut state_guard = state_for_recv.lock().unwrap();
                if let Some(table) = state_guard.get_mut(&table_id_for_recv) {
                    match table.game.process_action(&player_id_for_recv, client_action) {
                        Err(e) => println!("🔴 Action refusée pour {} : {}", player_id_for_recv, e),
                        Ok(_) => {
                            let update = build_state_update(table);
                            let _ = table.tx.send(update);
                        }
                    }
                }
            }
        }
    });

    // On attend que l'une des deux tâches se termine
    tokio::select! {
        _ = (&mut send_task) => {
            recv_task.abort();
        }
        _ = (&mut recv_task) => {
            // recv_task terminée : on laisse send_task vider sa queue avant de l'abort
            tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
            send_task.abort();
        }
    };

    println!("🔴 DECONNEXION : {} a quitté la table", player_id);

    let mut state_guard = state.lock().unwrap();
    if let Some(table) = state_guard.get_mut(&table_id) {
        table.game.players.retain(|p| p.pseudo != player_id);

        // Reset si plus assez de joueurs
        if table.game.players.len() < 2 {
            table.game.phase = crate::engine::game_loop::GamePhase::WaitingForPlayers;
            table.game.pot = 0;
            table.game.community_cards.clear();
            table.game.winners.clear();
            for p in &mut table.game.players {
                p.hole_cards = None;
                p.current_bet = 0;
                p.has_folded = false;
            }
        }

        // Sécuriser l'index après suppression
        if !table.game.players.is_empty()
            && table.game.current_player_index >= table.game.players.len()
        {
            table.game.current_player_index = 0;
        }

        let update = build_state_update(table);
        let _ = table.tx.send(update);
    }
}