use crate::blackjack::{BjConfig, BlackjackTable};
use crate::poker::{PokerConfig, PokerTable};
use crate::protocol::{ServerMsg, TableSummary};
use crate::accounts::Accounts;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use tokio::sync::mpsc;

pub type Out = mpsc::UnboundedSender<ServerMsg>;

pub const UNLIMITED: u64 = u64::MAX;

#[derive(Debug)]
pub enum TableCmd {
    Join { cid: u64, name: String, out: Out },
    Leave { cid: u64 },
    Sit { cid: u64, seat: usize, buy_in: Option<u64> },
    Stand { cid: u64 },
    Act { cid: u64, kind: String, amount: Option<u64> },
    Bet { cid: u64, amount: u64 },
    Chat { cid: u64, text: String },
}

pub struct TableHandle {
    pub tx: mpsc::UnboundedSender<TableCmd>,
    pub game: &'static str,
}

pub struct Hub {
    pub wallets: Accounts,
    pub tables: RwLock<HashMap<String, TableHandle>>,
    pub order: RwLock<Vec<String>>,
    pub summaries: RwLock<HashMap<String, TableSummary>>,
    pub online: Mutex<HashMap<String, (Out, Arc<tokio::sync::Notify>)>>,
    next_cid: AtomicU64,
}

impl Hub {
    pub fn new(data_dir: PathBuf) -> Arc<Self> {
        Arc::new(Self {
            wallets: Accounts::load(
                data_dir.join("accounts.json"),
                data_dir.join("wallets.json"),
                PathBuf::from(std::env::var("ADMINS_FILE").unwrap_or_else(|_| "admins.txt".into())),
            ),
            tables: RwLock::new(HashMap::new()),
            order: RwLock::new(Vec::new()),
            summaries: RwLock::new(HashMap::new()),
            online: Mutex::new(HashMap::new()),
            next_cid: AtomicU64::new(1),
        })
    }

    pub fn next_cid(&self) -> u64 {
        self.next_cid.fetch_add(1, Ordering::Relaxed)
    }

    pub fn set_summary(&self, s: TableSummary) {
        self.summaries.write().unwrap().insert(s.id.clone(), s);
    }

    pub fn lobby(&self) -> Vec<TableSummary> {
        let order = self.order.read().unwrap();
        let sums = self.summaries.read().unwrap();
        order.iter().filter_map(|id| sums.get(id).cloned()).collect()
    }

    pub fn send(&self, table: &str, cmd: TableCmd) -> bool {
        match self.tables.read().unwrap().get(table) {
            Some(h) => h.tx.send(cmd).is_ok(),
            None => false,
        }
    }

    pub fn notify(&self, name: &str, msgs: Vec<ServerMsg>) {
        if let Some((out, _)) = self.online.lock().unwrap().get(&crate::accounts::key(name)) {
            for m in msgs {
                let _ = out.send(m);
            }
        }
    }

    pub fn is_online(&self, name: &str) -> bool {
        self.online.lock().unwrap().contains_key(&crate::accounts::key(name))
    }

    pub fn game_of(&self, table: &str) -> Option<&'static str> {
        self.tables.read().unwrap().get(table).map(|h| h.game)
    }

    fn register(&self, id: String, game: &'static str, tx: mpsc::UnboundedSender<TableCmd>) {
        self.tables.write().unwrap().insert(id.clone(), TableHandle { tx, game });
        self.order.write().unwrap().push(id);
    }

    pub fn spawn_tables(self: &Arc<Self>) {
        let poker = [
            ("poker-1", "Clichy Montmartre", "emerald", 5, 10, 6, 200, 1_000),
            ("poker-2", "Club Barrière", "royal", 10, 20, 9, 400, 2_000),
            ("poker-3", "Deauville", "crimson", 25, 50, 6, 1_000, 5_000),
            ("poker-4", "Aviation Club", "teal", 50, 100, 9, 2_000, 10_000),
            ("poker-5", "Monte-Carlo", "onyx", 200, 400, 6, 8_000, 40_000),
            ("poker-6", "Aria Las Vegas", "velvet", 1_000, 2_000, 6, 40_000, 200_000),
            ("poker-7", "Bobby's Room", "onyx", 5_000, 10_000, 6, 200_000, UNLIMITED),
        ];
        for (id, name, theme, sb, bb, seats, min_buy, max_buy) in poker {
            let cfg = PokerConfig {
                id: id.to_string(),
                name: name.to_string(),
                theme,
                sb,
                bb,
                min_buy,
                max_buy,
                seats,
            };
            let (tx, rx) = mpsc::unbounded_channel();
            self.register(id.to_string(), "poker", tx);
            let table = PokerTable::new(cfg, self.clone());
            self.set_summary(table.summary());
            tokio::spawn(table.run(rx));
        }
        let bj = [
            ("blackjack-1", "Enghien-les-Bains", "crimson", 10, 500),
            ("blackjack-2", "Cannes Croisette", "royal", 50, 2_500),
            ("blackjack-3", "Baden-Baden", "emerald", 250, 10_000),
            ("blackjack-4", "Caesars Palace", "teal", 10_000, 50_000),
            ("blackjack-5", "Wynn Las Vegas", "velvet", 50_000, 250_000),
            ("blackjack-6", "Venetian Macao", "onyx", 250_000, UNLIMITED),
        ];
        for (id, name, theme, min_bet, max_bet) in bj {
            let cfg = BjConfig {
                id: id.to_string(),
                name: name.to_string(),
                theme,
                min_bet,
                max_bet,
                seats: 5,
            };
            let (tx, rx) = mpsc::unbounded_channel();
            self.register(id.to_string(), "blackjack", tx);
            let table = BlackjackTable::new(cfg, self.clone());
            self.set_summary(table.summary());
            tokio::spawn(table.run(rx));
        }
    }
}

pub fn scaled(ms: u64) -> u64 {
    static SCALE: std::sync::OnceLock<f64> = std::sync::OnceLock::new();
    let s = *SCALE.get_or_init(|| {
        std::env::var("TIMING_SCALE").ok().and_then(|v| v.parse().ok()).unwrap_or(1.0)
    });
    ((ms as f64) * s).max(1.0) as u64
}
