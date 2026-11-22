use crate::accounts::{key, Session};
use crate::hub::{Hub, TableCmd};
use crate::protocol::{AdminPlayerView, ClientMsg, ServerMsg};
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::response::IntoResponse;
use futures::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::{mpsc, Notify};

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

async fn authenticate(hub: &Arc<Hub>, msg: ClientMsg) -> Result<Session, (String, bool)> {
    match msg {
        ClientMsg::Register { name, password } => {
            let name = name.trim().to_string();
            if !valid_name(&name) {
                return Err(("Pseudo invalide (2 à 16 caractères, lettres et chiffres)".into(), false));
            }
            let h = hub.clone();
            tokio::task::spawn_blocking(move || h.wallets.register(&name, &password))
                .await
                .unwrap_or_else(|_| Err("Erreur interne".into()))
                .map_err(|e| (e, false))
        }
        ClientMsg::Login { name, password } => {
            let h = hub.clone();
            tokio::task::spawn_blocking(move || h.wallets.login(&name, &password))
                .await
                .unwrap_or_else(|_| Err("Erreur interne".into()))
                .map_err(|e| (e, false))
        }
        ClientMsg::Resume { token } => hub
            .wallets
            .resume(&token)
            .ok_or_else(|| ("Session expirée, reconnectez-vous".to_string(), true)),
        _ => Err(("Connectez-vous d'abord".into(), false)),
    }
}

fn fmt_num(n: u64) -> String {
    let digits = n.to_string();
    let mut out = String::new();
    for (i, c) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            out.push('\u{202f}');
        }
        out.push(c);
    }
    out
}

fn admin_players(hub: &Hub) -> ServerMsg {
    let (players, log) = hub.wallets.players();
    let players = players
        .into_iter()
        .map(|info| {
            let online = hub.is_online(&info.name);
            AdminPlayerView { info, online }
        })
        .collect();
    ServerMsg::AdminPlayers { players, log }
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
    let kill = Arc::new(Notify::new());
    let mut name: Option<String> = None;
    let mut token: Option<String> = None;
    let mut table: Option<String> = None;
    let err = |msg: &str| {
        let _ = tx.send(ServerMsg::Error { msg: msg.to_string() });
    };

    let release = |hub: &Hub, name: &str| {
        let mut online = hub.online.lock().unwrap();
        if online.get(&key(name)).map(|(o, _)| o.same_channel(&tx)).unwrap_or(false) {
            online.remove(&key(name));
        }
    };

    loop {
        let next = tokio::select! {
            m = stream.next() => m,
            _ = kill.notified() => break,
        };
        let Some(Ok(msg)) = next else { break };
        let text = match msg {
            Message::Text(t) => t,
            Message::Close(_) => break,
            _ => continue,
        };
        let Ok(cmsg) = serde_json::from_str::<ClientMsg>(&text) else {
            err("Message invalide");
            continue;
        };

        if matches!(cmsg, ClientMsg::Register { .. } | ClientMsg::Login { .. } | ClientMsg::Resume { .. }) {
            if name.is_some() {
                continue;
            }
            match authenticate(&hub, cmsg).await {
                Ok(session) => {
                    let previous = hub
                        .online
                        .lock()
                        .unwrap()
                        .insert(key(&session.name), (tx.clone(), kill.clone()));
                    if let Some((old_out, old_kill)) = previous {
                        let _ = old_out.send(ServerMsg::Notice {
                            msg: "Votre compte vient de se connecter depuis un autre appareil".into(),
                        });
                        let _ = old_out.send(ServerMsg::LoggedOut);
                        old_kill.notify_one();
                    }
                    name = Some(session.name.clone());
                    token = Some(session.token.clone());
                    let _ = tx.send(ServerMsg::Welcome {
                        name: session.name,
                        balance: session.balance,
                        player_id: session.id,
                        admin: session.admin,
                        token: session.token,
                    });
                    let _ = tx.send(ServerMsg::Lobby { tables: hub.lobby() });
                }
                Err((msg, fatal)) => {
                    let _ = tx.send(ServerMsg::AuthError { msg, fatal });
                }
            }
            continue;
        }

        let Some(me) = name.clone() else {
            err("Connectez-vous d'abord");
            continue;
        };

        match cmsg {
            ClientMsg::Register { .. } | ClientMsg::Login { .. } | ClientMsg::Resume { .. } => {}
            ClientMsg::Logout => {
                if let Some(t) = table.take() {
                    hub.send(&t, TableCmd::Leave { cid });
                }
                if let Some(t) = token.take() {
                    hub.wallets.logout(&t);
                }
                release(&hub, &me);
                name = None;
                let _ = tx.send(ServerMsg::LoggedOut);
            }
            ClientMsg::Lobby => {
                let _ = tx.send(ServerMsg::Lobby { tables: hub.lobby() });
            }
            ClientMsg::Refill => match hub.wallets.refill(&me) {
                Ok(balance) => {
                    let _ = tx.send(ServerMsg::Balance { balance });
                }
                Err(e) => err(e),
            },
            ClientMsg::AdminList => {
                if !hub.wallets.is_admin(&me) {
                    err("Réservé aux administrateurs");
                    continue;
                }
                let _ = tx.send(admin_players(&hub));
            }
            ClientMsg::AdminGive { player_id, amount, reason } => {
                match hub.wallets.admin_gift(&me, player_id, amount, reason.clone()) {
                    Ok(r) => {
                        let verb = if r.applied >= 0 { "reçoit" } else { "perd" };
                        let _ = tx.send(ServerMsg::Notice {
                            msg: format!("{} (n°{}) {} {} jetons", r.target, player_id, verb, fmt_num(r.applied.unsigned_abs())),
                        });
                        let detail = reason
                            .map(|x| x.trim().to_string())
                            .filter(|x| !x.is_empty())
                            .map(|x| format!(" : {}", x))
                            .unwrap_or_default();
                        let note = if r.applied >= 0 {
                            format!("{} vous a offert {} jetons{}", me, fmt_num(r.applied.unsigned_abs()), detail)
                        } else {
                            format!("{} vous a retiré {} jetons{}", me, fmt_num(r.applied.unsigned_abs()), detail)
                        };
                        hub.notify(&r.target, vec![ServerMsg::Balance { balance: r.balance }, ServerMsg::Notice { msg: note }]);
                        let _ = tx.send(admin_players(&hub));
                    }
                    Err(e) => err(&e),
                }
            }
            ClientMsg::AdminSetAdmin { player_id, admin } => match hub.wallets.set_admin(&me, player_id, admin) {
                Ok(target) => {
                    let note = if admin {
                        format!("{} vous a nommé administrateur", me)
                    } else {
                        format!("{} vous a retiré le rôle d'administrateur", me)
                    };
                    hub.notify(&target, vec![ServerMsg::Role { admin }, ServerMsg::Notice { msg: note }]);
                    let _ = tx.send(ServerMsg::Notice {
                        msg: if admin { format!("{} est maintenant administrateur", target) } else { format!("{} n'est plus administrateur", target) },
                    });
                    let _ = tx.send(admin_players(&hub));
                }
                Err(e) => err(&e),
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
        release(&hub, &n);
    }
    drop(tx);
    let _ = tokio::time::timeout(std::time::Duration::from_millis(200), writer).await;
}
