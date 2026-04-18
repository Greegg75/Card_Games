use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, Path, State},
    response::IntoResponse,
};
use futures::{sink::SinkExt, stream::StreamExt};
use crate::state::lobby::{AppState, PokerTable};
use crate::network::messages::{ClientMessage, ServerMessage};

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(table_id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, table_id, state))
}

async fn handle_socket(socket: WebSocket, table_id: String, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let player_id = format!("Joueur_{}", rand::random::<u16>());

    println!("🟢 NOUVELLE CONNEXION : {} rejoint la table {}", player_id, table_id);

    let welcome_msg = serde_json::to_string(&ServerMessage::Welcome { pseudo: player_id.clone() }).unwrap();
    let _ = sender.send(Message::Text(welcome_msg)).await;

    // CORRECTION 1 : On ajoute 'mut' ici pour que rx puisse lire les messages
    let mut rx = {
        let mut state_guard = state.lock().unwrap();
        let table = state_guard.entry(table_id.clone()).or_insert_with(PokerTable::new);
        
        table.game.add_player(player_id.clone(), 1000);
        let rx = table.tx.subscribe();

        let mut players_info = Vec::new();
        let mut hole_cards_map = std::collections::HashMap::new();

        for p in &table.game.players {
            players_info.push(crate::network::messages::PlayerInfo {
                pseudo: p.pseudo.clone(),
                chips: p.chips,
                current_bet: p.current_bet,
                has_folded: p.has_folded,
                current_hand: Some("Analyse en cours...".to_string()),
            });
            if let Some(cards) = &p.hole_cards {
                hole_cards_map.insert(p.pseudo.clone(), vec![cards[0].to_string(), cards[1].to_string()]);
            }
        }

        let update = ServerMessage::GameStateUpdate {
            phase: format!("{:?}", table.game.phase),
            pot: table.game.pot,
            community_cards: table.game.community_cards.iter().map(|c| c.to_string()).collect(),
            current_turn_pseudo: if table.game.players.is_empty() { None } else { Some(table.game.players[table.game.current_player_index].pseudo.clone()) },
            players: players_info,
            hole_cards: hole_cards_map,
        };

        let _ = table.tx.send(update);
        rx
    };

    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            let json_msg = serde_json::to_string(&msg).unwrap();
            if sender.send(Message::Text(json_msg)).await.is_err() { break; }
        }
    });

    let player_id_for_recv = player_id.clone();
    
    // CORRECTION 2 : On fait une photocopie de state et table_id pour la tâche de réception
    let state_for_recv = state.clone();
    let table_id_for_recv = table_id.clone();

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(Message::Text(text))) = receiver.next().await {
            if let Ok(client_action) = serde_json::from_str::<ClientMessage>(&text) {
                
                // On utilise les photocopies ici
                let mut state_guard = state_for_recv.lock().unwrap();
                if let Some(table) = state_guard.get_mut(&table_id_for_recv) {
                    
                    let action_result = table.game.process_action(&player_id_for_recv, client_action);
                    
                    if let Err(e) = action_result {
                        println!("🔴 Action refusée pour {} : {}", player_id_for_recv, e);
                    } else {
                        let mut hole_cards_map = std::collections::HashMap::new();
                        let mut players_info = Vec::new();

                        for p in &table.game.players {
                            players_info.push(crate::network::messages::PlayerInfo {
                                pseudo: p.pseudo.clone(), 
                                chips: p.chips, 
                                current_bet: p.current_bet, 
                                has_folded: p.has_folded,
                                current_hand: Some("Analyse en cours...".to_string()),
                            });
                            if let Some(cards) = &p.hole_cards {
                                hole_cards_map.insert(p.pseudo.clone(), vec![cards[0].to_string(), cards[1].to_string()]);
                            }
                        }

                        let update = ServerMessage::GameStateUpdate {
                            phase: format!("{:?}", table.game.phase),
                            pot: table.game.pot,
                            community_cards: table.game.community_cards.iter().map(|c| c.to_string()).collect(),
                            current_turn_pseudo: Some(table.game.players[table.game.current_player_index].pseudo.clone()),
                            players: players_info,
                            hole_cards: hole_cards_map,
                        };

                        let _ = table.tx.send(update);
                    }
                }
            }
        }
    });

    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };

    println!("🔴 DECONNEXION : {} a quitté la table", player_id);

    // CORRECTION 3 : Ici on peut utiliser les vrais 'state' et 'table_id' originaux car ils n'ont pas été "mangés" par la tâche !
    let mut state_guard = state.lock().unwrap();
    if let Some(table) = state_guard.get_mut(&table_id) {
        table.game.players.retain(|p| p.pseudo != player_id);
        
        if table.game.players.len() < 2 {
            table.game.phase = crate::engine::game_loop::GamePhase::WaitingForPlayers;
            table.game.pot = 0;
            table.game.community_cards.clear();
            for p in &mut table.game.players {
                p.hole_cards = None;
                p.current_bet = 0;
                p.has_folded = false;
            }
        }
        
        if table.game.current_player_index >= table.game.players.len() && !table.game.players.is_empty() {
            table.game.current_player_index = 0;
        }

        let mut players_info = Vec::new();
        for p in &table.game.players {
            players_info.push(crate::network::messages::PlayerInfo {
                pseudo: p.pseudo.clone(), 
                chips: p.chips, 
                current_bet: p.current_bet, 
                has_folded: p.has_folded,
                current_hand: None, 
            });
        }
        
        let update = ServerMessage::GameStateUpdate {
            phase: format!("{:?}", table.game.phase),
            pot: table.game.pot,
            community_cards: table.game.community_cards.iter().map(|c| c.to_string()).collect(),
            current_turn_pseudo: if table.game.players.is_empty() { None } else { Some(table.game.players[table.game.current_player_index].pseudo.clone()) },
            players: players_info,
            hole_cards: std::collections::HashMap::new(), 
        };
        
        let _ = table.tx.send(update);
    }
}