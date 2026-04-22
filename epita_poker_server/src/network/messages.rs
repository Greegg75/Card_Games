use serde::{Deserialize, Serialize};

#[derive(Deserialize, Debug)]
#[serde(tag = "action", content = "payload")]
pub enum ClientMessage {
    JoinTable { pseudo: String },
    Chat { message: String },
    StartGame,
    Fold,
    Check,
    Call,
    Raise { amount: u64 },
}

#[derive(Serialize, Clone, Debug)]
pub struct PlayerInfo {
    pub pseudo: String,
    pub chips: u64,
    pub current_bet: u64,
    pub has_folded: bool,
    pub current_hand: Option<String>,
    pub seat: u8,
}

#[derive(Serialize, Clone, Debug)]
pub struct WinnerInfo {
    pub pseudo: String,
    pub amount_won: u64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(tag = "type", content = "data")]
pub enum ServerMessage {
    Welcome { pseudo: String, seat: u8 },
    PlayerJoined { pseudo: String },

    GameStateUpdate {
        phase: String,
        pot: u64,
        community_cards: Vec<String>,
        current_turn_pseudo: Option<String>,
        players: Vec<PlayerInfo>,
        hole_cards: std::collections::HashMap<String, Vec<String>>,
        winners: Vec<WinnerInfo>,
    },

    Error { message: String },
}