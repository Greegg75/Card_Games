use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;
use crate::engine::game_loop::PokerGame;
use crate::network::messages::ServerMessage;

pub struct PokerTable {
    pub game: PokerGame, // Le moteur de jeu est maintenant ici !
    pub tx: broadcast::Sender<ServerMessage>,
}

impl PokerTable {
    pub fn new() -> Self {
        let (tx, _rx) = broadcast::channel(100);
        Self {
            game: PokerGame::new(),
            tx,
        }
    }
}

pub type AppState = Arc<Mutex<HashMap<String, PokerTable>>>;

pub fn init_state() -> AppState {
    let mut state = HashMap::new();
    state.insert("table1".to_string(), PokerTable::new());
    Arc::new(Mutex::new(state))
}