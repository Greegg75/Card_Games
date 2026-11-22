use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

pub const STARTING_BALANCE: u64 = 20_000;
pub const REFILL_THRESHOLD: u64 = 2_000;
const MAX_TOKENS: usize = 5;
const MAX_LOG: usize = 300;
const MAX_GIFT: u64 = 100_000_000;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Account {
    pub name: String,
    pub id: u32,
    #[serde(default)]
    pub hash: String,
    pub balance: u64,
    #[serde(default)]
    pub tokens: Vec<String>,
    #[serde(default)]
    pub created: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LogEntry {
    pub at: u64,
    pub admin: String,
    pub target: String,
    pub target_id: u32,
    pub amount: i64,
    pub reason: Option<String>,
}

#[derive(Serialize, Deserialize, Default)]
struct Store {
    accounts: HashMap<String, Account>,
    #[serde(default)]
    log: Vec<LogEntry>,
}

#[derive(Serialize, Clone, Debug)]
pub struct PlayerInfo {
    pub id: u32,
    pub name: String,
    pub balance: u64,
    pub admin: bool,
    pub claimed: bool,
}

pub struct Session {
    pub name: String,
    pub id: u32,
    pub balance: u64,
    pub admin: bool,
    pub token: String,
}

pub struct GiftResult {
    pub target: String,
    pub balance: u64,
    pub applied: i64,
}

pub struct AdminList {
    path: PathBuf,
    cache: Mutex<(Option<SystemTime>, HashSet<String>)>,
}

impl AdminList {
    pub fn new(path: PathBuf) -> Self {
        let list = Self { path, cache: Mutex::new((None, HashSet::new())) };
        let names = list.names();
        if names.is_empty() {
            tracing::warn!("Aucun administrateur : ajoutez des pseudos dans {}", list.path.display());
        } else {
            tracing::info!("Administrateurs ({}) : {}", list.path.display(), names.join(", "));
        }
        list
    }

    fn current(&self) -> HashSet<String> {
        let modified = std::fs::metadata(&self.path).and_then(|m| m.modified()).ok();
        let mut cache = self.cache.lock().unwrap();
        if cache.0.is_none() || cache.0 != modified {
            let set = std::fs::read_to_string(&self.path)
                .unwrap_or_default()
                .lines()
                .map(|l| l.trim())
                .filter(|l| !l.is_empty() && !l.starts_with('#'))
                .map(key)
                .collect();
            *cache = (modified, set);
        }
        cache.1.clone()
    }

    pub fn contains(&self, name: &str) -> bool {
        self.current().contains(&key(name))
    }

    pub fn names(&self) -> Vec<String> {
        let mut v: Vec<String> = self.current().into_iter().collect();
        v.sort();
        v
    }
}

pub struct Accounts {
    path: PathBuf,
    store: Mutex<Store>,
    admins: AdminList,
}

pub fn key(name: &str) -> String {
    name.trim().to_lowercase()
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn new_token() -> String {
    let mut rng = rand::thread_rng();
    (0..32).map(|_| format!("{:02x}", rng.gen::<u8>())).collect()
}

fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|_| "Erreur interne lors de la création du compte".to_string())
}

fn verify_password(password: &str, hash: &str) -> bool {
    PasswordHash::new(hash)
        .map(|parsed| Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok())
        .unwrap_or(false)
}

impl Accounts {
    pub fn load(path: PathBuf, legacy: PathBuf, admins: PathBuf) -> Self {
        let mut store: Store = std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        if store.accounts.is_empty() {
            let old: HashMap<String, u64> = std::fs::read_to_string(&legacy)
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default();
            for (name, balance) in old {
                let id = Self::fresh_id(&store);
                store.accounts.insert(
                    key(&name),
                    Account { name, id, hash: String::new(), balance, tokens: vec![], created: now() },
                );
            }
        }
        let accounts = Self { path, store: Mutex::new(store), admins: AdminList::new(admins) };
        accounts.save(&accounts.store.lock().unwrap());
        accounts
    }

    fn fresh_id(store: &Store) -> u32 {
        let mut rng = rand::thread_rng();
        loop {
            let id = rng.gen_range(100_000..1_000_000);
            if !store.accounts.values().any(|a| a.id == id) {
                return id;
            }
        }
    }

    fn save(&self, store: &Store) {
        if let Some(parent) = self.path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(s) = serde_json::to_string_pretty(store) {
            let tmp = self.path.with_extension("json.tmp");
            if std::fs::write(&tmp, s).is_ok() {
                let _ = std::fs::rename(&tmp, &self.path);
            }
        }
    }

    fn open_session(&self, acc: &mut Account) -> Session {
        let token = new_token();
        acc.tokens.push(token.clone());
        while acc.tokens.len() > MAX_TOKENS {
            acc.tokens.remove(0);
        }
        Session { name: acc.name.clone(), id: acc.id, balance: acc.balance, admin: self.admins.contains(&acc.name), token }
    }

    pub fn register(&self, name: &str, password: &str) -> Result<Session, String> {
        if password.chars().count() < 4 {
            return Err("Le mot de passe doit contenir au moins 4 caractères".into());
        }
        let hash = hash_password(password)?;
        let mut store = self.store.lock().unwrap();
        let k = key(name);
        let session = match store.accounts.get_mut(&k) {
            Some(acc) if !acc.hash.is_empty() => return Err("Ce pseudo est déjà pris".into()),
            Some(acc) => {
                acc.hash = hash;
                self.open_session(acc)
            }
            None => {
                let id = Self::fresh_id(&store);
                let mut acc = Account {
                    name: name.trim().to_string(),
                    id,
                    hash,
                    balance: STARTING_BALANCE,
                    tokens: vec![],
                    created: now(),
                };
                let session = self.open_session(&mut acc);
                store.accounts.insert(k, acc);
                session
            }
        };
        self.save(&store);
        Ok(session)
    }

    pub fn login(&self, name: &str, password: &str) -> Result<Session, String> {
        let k = key(name);
        let hash = {
            let store = self.store.lock().unwrap();
            match store.accounts.get(&k) {
                None => return Err("Pseudo ou mot de passe incorrect".into()),
                Some(acc) if acc.hash.is_empty() => {
                    return Err("Ce compte n'a pas encore de mot de passe : utilisez « Créer un compte » avec ce pseudo pour le récupérer".into())
                }
                Some(acc) => acc.hash.clone(),
            }
        };
        if !verify_password(password, &hash) {
            return Err("Pseudo ou mot de passe incorrect".into());
        }
        let mut store = self.store.lock().unwrap();
        let acc = store.accounts.get_mut(&k).ok_or("Compte introuvable")?;
        let session = self.open_session(acc);
        self.save(&store);
        Ok(session)
    }

    pub fn resume(&self, token: &str) -> Option<Session> {
        if token.len() < 32 {
            return None;
        }
        let store = self.store.lock().unwrap();
        store
            .accounts
            .values()
            .find(|a| a.tokens.iter().any(|t| t == token))
            .map(|a| Session { name: a.name.clone(), id: a.id, balance: a.balance, admin: self.admins.contains(&a.name), token: token.to_string() })
    }

    pub fn logout(&self, token: &str) {
        let mut store = self.store.lock().unwrap();
        for acc in store.accounts.values_mut() {
            acc.tokens.retain(|t| t != token);
        }
        self.save(&store);
    }

    pub fn balance(&self, name: &str) -> u64 {
        self.store.lock().unwrap().accounts.get(&key(name)).map(|a| a.balance).unwrap_or(0)
    }

    pub fn is_admin(&self, name: &str) -> bool {
        self.admins.contains(name)
    }

    pub fn take(&self, name: &str, amount: u64) -> bool {
        let mut store = self.store.lock().unwrap();
        let Some(acc) = store.accounts.get_mut(&key(name)) else { return false };
        if acc.balance < amount {
            return false;
        }
        acc.balance -= amount;
        self.save(&store);
        true
    }

    pub fn give(&self, name: &str, amount: u64) {
        if amount == 0 {
            return;
        }
        let mut store = self.store.lock().unwrap();
        if let Some(acc) = store.accounts.get_mut(&key(name)) {
            acc.balance = acc.balance.saturating_add(amount);
            self.save(&store);
        }
    }

    pub fn refill(&self, name: &str) -> Result<u64, &'static str> {
        let mut store = self.store.lock().unwrap();
        let acc = store.accounts.get_mut(&key(name)).ok_or("Compte introuvable")?;
        if acc.balance >= REFILL_THRESHOLD {
            return Err("La recharge n'est possible que sous 2 000 jetons");
        }
        acc.balance = STARTING_BALANCE;
        let v = acc.balance;
        self.save(&store);
        Ok(v)
    }

    pub fn players(&self) -> (Vec<PlayerInfo>, Vec<LogEntry>) {
        let store = self.store.lock().unwrap();
        let mut list: Vec<PlayerInfo> = store
            .accounts
            .values()
            .map(|a| PlayerInfo { id: a.id, name: a.name.clone(), balance: a.balance, admin: self.admins.contains(&a.name), claimed: !a.hash.is_empty() })
            .collect();
        list.sort_by_key(|p| p.name.to_lowercase());
        let log = store.log.iter().rev().take(50).cloned().collect();
        (list, log)
    }

    pub fn admin_gift(&self, admin: &str, target_id: u32, amount: i64, reason: Option<String>) -> Result<GiftResult, String> {
        if amount == 0 {
            return Err("Le montant ne peut pas être nul".into());
        }
        if amount.unsigned_abs() > MAX_GIFT {
            return Err(format!("Montant maximum par opération : {}", MAX_GIFT));
        }
        if !self.admins.contains(admin) {
            return Err("Réservé aux administrateurs".into());
        }
        let mut store = self.store.lock().unwrap();
        let admin_name = store.accounts.get(&key(admin)).ok_or("Compte introuvable")?.name.clone();
        let acc = store
            .accounts
            .values_mut()
            .find(|a| a.id == target_id)
            .ok_or_else(|| format!("Aucun joueur avec le numéro {}", target_id))?;
        let before = acc.balance;
        acc.balance = if amount > 0 {
            acc.balance.saturating_add(amount as u64)
        } else {
            acc.balance.saturating_sub(amount.unsigned_abs())
        };
        let applied = acc.balance as i64 - before as i64;
        let result = GiftResult { target: acc.name.clone(), balance: acc.balance, applied };
        let reason = reason
            .map(|r| r.trim().chars().take(120).collect::<String>())
            .filter(|r| !r.is_empty());
        store.log.push(LogEntry {
            at: now(),
            admin: admin_name,
            target: result.target.clone(),
            target_id,
            amount: applied,
            reason,
        });
        while store.log.len() > MAX_LOG {
            store.log.remove(0);
        }
        self.save(&store);
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp() -> Accounts {
        let dir = std::env::temp_dir().join(format!("aurum-test-{}", new_token()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("admins.txt"), "Greg\n\n# commentaire\n  ENZO  \n").unwrap();
        Accounts::load(dir.join("accounts.json"), dir.join("wallets.json"), dir.join("admins.txt"))
    }

    #[test]
    fn admins_come_from_file() {
        let a = temp();
        let g = a.register("Greg", "secret").unwrap();
        assert!(g.admin);
        let e = a.register("Enzo", "motdepasse").unwrap();
        assert!(e.admin);
        let t = a.register("Thibault", "motdepasse").unwrap();
        assert!(!t.admin);
        assert!(a.register("greg", "autre").is_err());
        assert!(a.login("GREG", "secret").is_ok());
        assert!(a.login("Greg", "faux").is_err());
        assert!(a.resume(&t.token).is_some());
        let r = a.admin_gift("Greg", t.id, 5_000, Some("bravo".into())).unwrap();
        assert_eq!(r.balance, STARTING_BALANCE + 5_000);
        let r = a.admin_gift("Enzo", t.id, -1_000_000, None).unwrap();
        assert_eq!(r.balance, 0);
        assert!(a.admin_gift("Thibault", g.id, 10, None).is_err());
        assert_eq!(a.admins.names(), vec!["enzo".to_string(), "greg".to_string()]);
        a.logout(&t.token);
        assert!(a.resume(&t.token).is_none());
    }
}
