use crate::hub::{Hub, TableCmd};
use crate::protocol::{ClientMsg, ServerMsg};
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::response::IntoResponse;
use futures::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::mpsc;

pub async fn ws_handler(ws: WebSocketUpgrade, State(hub): State<Arc<Hub>>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle(socket, hub))
}

fn valid_name(name: &str) -> bool {
    let len = name.chars().count();
    (2..=16).contains(&len)
        && name
            .chars()
            .all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == ' ' || c == '.')
}

async fn handle(socket: WebSocket, hub: Arc<Hub>) {
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<ServerMsg>();
    let writer = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let Ok(text) = serde_json::to_string(&msg) else { continue };
            if sink.send(Message::Text(text)).await.is_err() {
                break;
            }
        }
    });

    let cid = hub.next_cid();
    let mut name: Option<String> = None;
    let mut table: Option<String> = None;
    let err = |msg: &str| {
        let _ = tx.send(ServerMsg::Error { msg: msg.to_string() });
    };

    while let Some(Ok(msg)) = stream.next().await {
        let text = match msg {
            Message::Text(t) => t,
            Message::Close(_) => break,
            _ => continue,
        };
        let Ok(cmsg) = serde_json::from_str::<ClientMsg>(&text) else {
            err("Message invalide");
            continue;
        };
        if let ClientMsg::Hello { name: wanted } = &cmsg {
            if name.is_some() {
                continue;
            }
            let wanted = wanted.trim().to_string();
            if !valid_name(&wanted) {
                err("Pseudo invalide (2 à 16 caractères, lettres et chiffres)");
                continue;
            }
            if !hub.online.lock().unwrap().insert(wanted.clone()) {
                err("Ce pseudo est déjà connecté");
                continue;
            }
            let balance = hub.wallets.ensure(&wanted);
            name = Some(wanted.clone());
            let _ = tx.send(ServerMsg::Welcome { name: wanted, balance });
            let _ = tx.send(ServerMsg::Lobby { tables: hub.lobby() });
            continue;
        }
        let Some(me) = name.clone() else {
            err("Choisissez un pseudo");
            continue;
        };
        match cmsg {
            ClientMsg::Hello { .. } => {}
            ClientMsg::Lobby => {
                let _ = tx.send(ServerMsg::Lobby { tables: hub.lobby() });
            }
            ClientMsg::Refill => match hub.wallets.refill(&me) {
                Ok(balance) => {
                    let _ = tx.send(ServerMsg::Balance { balance });
                }
                Err(e) => err(e),
            },
            ClientMsg::Join { table: id } => {
                if let Some(old) = table.take() {
                    hub.send(&old, TableCmd::Leave { cid });
                }
                match hub.game_of(&id) {
                    Some(game) => {
                        hub.send(&id, TableCmd::Join { cid, name: me.clone(), out: tx.clone() });
                        let _ = tx.send(ServerMsg::Joined { table: id.clone(), game });
                        table = Some(id);
                    }
                    None => err("Table introuvable"),
                }
            }
            ClientMsg::Leave => {
                if let Some(old) = table.take() {
                    hub.send(&old, TableCmd::Leave { cid });
                }
                let _ = tx.send(ServerMsg::Left);
                let _ = tx.send(ServerMsg::Balance { balance: hub.wallets.balance(&me) });
            }
            other => {
                let Some(t) = table.clone() else {
                    err("Rejoignez une table d'abord");
                    continue;
                };
                let cmd = match other {
                    ClientMsg::Sit { seat, buy_in } => TableCmd::Sit { cid, seat, buy_in },
                    ClientMsg::Stand => TableCmd::Stand { cid },
                    ClientMsg::Act { kind, amount } => TableCmd::Act { cid, kind, amount },
                    ClientMsg::Bet { amount } => TableCmd::Bet { cid, amount },
                    ClientMsg::Chat { text } => TableCmd::Chat { cid, text },
                    _ => continue,
                };
                hub.send(&t, cmd);
            }
        }
    }

    if let Some(t) = table {
        hub.send(&t, TableCmd::Leave { cid });
    }
    if let Some(n) = name {
        hub.online.lock().unwrap().remove(&n);
    }
    drop(tx);
    let _ = tokio::time::timeout(std::time::Duration::from_millis(200), writer).await;
}
