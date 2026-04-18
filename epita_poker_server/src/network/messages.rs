use serde::{Deserialize, Serialize};

#[derive(Deserialize, Debug)]
#[serde(tag = "action", content = "payload")]
pub enum ClientMessage {
    JoinTable { pseudo: String },
    Chat { message: String },
    StartGame, // <-- NOUVEAU: Le bouton pour lancer la partie !
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
}

#[derive(Serialize, Clone, Debug)]
#[serde(tag = "type", content = "data")]
pub enum ServerMessage {
    Welcome { pseudo: String }, // <-- Pour dire à React "Voici ton pseudo"
    PlayerJoined { pseudo: String },
    
    GameStateUpdate {
        phase: String,
        pot: u64,
        community_cards: Vec<String>,
        current_turn_pseudo: Option<String>,
        players: Vec<PlayerInfo>, // NOUVEAU: La liste des joueurs et leur argent
        hole_cards: std::collections::HashMap<String, Vec<String>>, // NOUVEAU: Les cartes de chaque joueur
    },
    
    Error { message: String },
}