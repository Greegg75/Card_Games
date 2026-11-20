use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

pub const STARTING_BALANCE: u64 = 20_000;
pub const REFILL_THRESHOLD: u64 = 2_000;

pub struct Wallets {
    path: PathBuf,
    balances: Mutex<HashMap<String, u64>>,
}

impl Wallets {
    pub fn load(path: PathBuf) -> Self {
        let balances = std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        Self { path, balances: Mutex::new(balances) }
    }

    fn save(&self, map: &HashMap<String, u64>) {
        if let Some(parent) = self.path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(s) = serde_json::to_string_pretty(map) {
            let _ = std::fs::write(&self.path, s);
        }
    }

    pub fn ensure(&self, name: &str) -> u64 {
        let mut m = self.balances.lock().unwrap();
        if !m.contains_key(name) {
            m.insert(name.to_string(), STARTING_BALANCE);
            self.save(&m);
        }
        m[name]
    }

    pub fn balance(&self, name: &str) -> u64 {
        self.balances.lock().unwrap().get(name).copied().unwrap_or(0)
    }

    pub fn take(&self, name: &str, amount: u64) -> bool {
        let mut m = self.balances.lock().unwrap();
        let b = m.entry(name.to_string()).or_insert(0);
        if *b < amount {
            return false;
        }
        *b -= amount;
        self.save(&m);
        true
    }

    pub fn give(&self, name: &str, amount: u64) {
        if amount == 0 {
            return;
        }
        let mut m = self.balances.lock().unwrap();
        *m.entry(name.to_string()).or_insert(0) += amount;
        self.save(&m);
    }

    pub fn refill(&self, name: &str) -> Result<u64, &'static str> {
        let mut m = self.balances.lock().unwrap();
        let b = m.entry(name.to_string()).or_insert(0);
        if *b >= REFILL_THRESHOLD {
            return Err("La recharge n'est possible que sous 2 000 jetons");
        }
        *b = STARTING_BALANCE;
        let v = *b;
        self.save(&m);
        Ok(v)
    }
}
