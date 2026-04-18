use std::sync::atomic::{AtomicU64, Ordering};

/// Représente l'identité globale et le compte d'un joueur
#[derive(Debug)]
pub struct Player {
    pub id: String,
    pub pseudo: String,
    // AtomicU64 permet des modifications thread-safe sans utiliser de Mutex !
    pub account_balance: AtomicU64, 
}

impl Player {
    pub fn new(id: String, pseudo: String, initial_balance: u64) -> Self {
        Self {
            id,
            pseudo,
            account_balance: AtomicU64::new(initial_balance),
        }
    }

    /// Récupère le solde actuel
    pub fn get_balance(&self) -> u64 {
        // Relaxed est suffisant ici car on veut juste lire la valeur 
        // sans contrainte stricte de synchronisation de la mémoire globale.
        self.account_balance.load(Ordering::Relaxed)
    }

    /// Ajoute des jetons au compte (ex: bonus journalier, ou gain d'une partie)
    pub fn add_funds(&self, amount: u64) {
        self.account_balance.fetch_add(amount, Ordering::Relaxed);
    }

    /// Tente de retirer des jetons (ex: pour s'asseoir à une table ou recaver)
    /// Retourne une erreur si les fonds sont insuffisants.
    pub fn deduct_funds(&self, amount: u64) -> Result<(), &'static str> {
        let mut current = self.account_balance.load(Ordering::Relaxed);
        
        loop {
            // Vérification de sécurité : pas de solde négatif !
            if current < amount {
                return Err("Fonds insuffisants");
            }

            // check-and-modify atomique (Compare-and-Swap)
            match self.account_balance.compare_exchange_weak(
                current,
                current - amount,
                Ordering::SeqCst, // Ordre strict si la modification réussit
                Ordering::Relaxed, // Si on échoue, on relâche
            ) {
                Ok(_) => return Ok(()), // Succès !
                Err(actual) => {
                    // Un autre thread a modifié le solde entre notre load et notre swap.
                    // 'actual' contient la nouvelle valeur, on met à jour 'current' et on reboucle.
                    current = actual;
                }
            }
        }
    }
}