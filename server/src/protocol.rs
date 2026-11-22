use crate::accounts::{LogEntry, PlayerInfo};
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Debug)]
#[serde(tag = "t", rename_all = "snake_case")]
pub enum ClientMsg {
    Register { name: String, password: String },
    Login { name: String, password: String },
    Resume { token: String },
    Logout,
    AdminList,
    AdminGive { player_id: u32, amount: i64, reason: Option<String> },
    Lobby,
    Refill,
    Join { table: String },
    Leave,
    Sit { seat: usize, buy_in: Option<u64> },
    Stand,
    Act { kind: String, amount: Option<u64> },
    Bet { amount: u64 },
    Chat { text: String },
}

#[derive(Serialize, Clone, Debug)]
pub struct TableSummary {
    pub id: String,
    pub game: &'static str,
    pub name: String,
    pub theme: &'static str,
    pub stakes: String,
    pub small_blind: u64,
    pub big_blind: u64,
    pub min_buy: u64,
    pub max_buy: u64,
    pub min_bet: u64,
    pub max_bet: u64,
    pub seats: usize,
    pub players: usize,
    pub watchers: usize,
}

#[derive(Serialize, Clone, Debug)]
pub struct PokerSeatView {
    pub name: String,
    pub stack: u64,
    pub bet: u64,
    pub in_hand: bool,
    pub folded: bool,
    pub all_in: bool,
    pub has_cards: bool,
    pub cards: Option<Vec<String>>,
    pub hand_name: Option<String>,
    pub last_action: Option<String>,
    pub leaving: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct PokerWinner {
    pub seat: usize,
    pub name: String,
    pub amount: u64,
    pub hand_name: Option<String>,
    pub best: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct PokerView {
    pub table: TableSummary,
    pub phase: String,
    pub hand_no: u64,
    pub board: Vec<String>,
    pub pot: u64,
    pub pots: Vec<u64>,
    pub current_bet: u64,
    pub min_raise_to: u64,
    pub max_raise_to: u64,
    pub to_call: u64,
    pub button: Option<usize>,
    pub sb_seat: Option<usize>,
    pub bb_seat: Option<usize>,
    pub to_act: Option<usize>,
    pub timer_ms: Option<u64>,
    pub timer_total_ms: u64,
    pub seats: Vec<Option<PokerSeatView>>,
    pub you: Option<usize>,
    pub my_cards: Vec<String>,
    pub my_hand: Option<String>,
    pub my_category: Option<u8>,
    pub winners: Vec<PokerWinner>,
    pub log: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct BjHandView {
    pub cards: Vec<String>,
    pub bet: u64,
    pub value: String,
    pub total: u8,
    pub doubled: bool,
    pub done: bool,
    pub result: Option<String>,
    pub payout: u64,
}

#[derive(Serialize, Clone, Debug)]
pub struct BjSeatView {
    pub name: String,
    pub bet: u64,
    pub last_bet: u64,
    pub hands: Vec<BjHandView>,
    pub leaving: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct BjView {
    pub table: TableSummary,
    pub phase: String,
    pub round_no: u64,
    pub timer_ms: Option<u64>,
    pub timer_total_ms: u64,
    pub dealer_cards: Vec<String>,
    pub dealer_value: Option<String>,
    pub seats: Vec<Option<BjSeatView>>,
    pub turn_seat: Option<usize>,
    pub turn_hand: Option<usize>,
    pub you: Option<usize>,
    pub can_double: bool,
    pub can_split: bool,
    pub shoe_left: usize,
    pub log: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(tag = "t", rename_all = "snake_case")]
pub enum ServerMsg {
    Welcome { name: String, balance: u64, player_id: u32, admin: bool, token: String },
    AuthError { msg: String, fatal: bool },
    LoggedOut,
    Notice { msg: String },
    AdminPlayers { players: Vec<AdminPlayerView>, log: Vec<LogEntry> },
    Error { msg: String },
    Balance { balance: u64 },
    Lobby { tables: Vec<TableSummary> },
    Joined { table: String, game: &'static str },
    Left,
    Poker { state: Box<PokerView> },
    Blackjack { state: Box<BjView> },
    Chat { from: String, text: String },
}

#[derive(Serialize, Clone, Debug)]
pub struct AdminPlayerView {
    #[serde(flatten)]
    pub info: PlayerInfo,
    pub online: bool,
}
