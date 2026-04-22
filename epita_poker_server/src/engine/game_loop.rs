use crate::engine::cards::Card;
use crate::engine::deck::Deck;
use crate::network::messages::ClientMessage;

#[derive(Debug, Clone, PartialEq)]
pub enum GamePhase {
    WaitingForPlayers,
    PreFlop,
    Flop,
    Turn,
    River,
    Showdown,
}

pub struct PlayerState {
    pub pseudo: String,
    pub chips: u64,
    pub current_bet: u64,
    pub hole_cards: Option<[Card; 2]>,
    pub has_folded: bool,
    pub seat: u8,
}

pub struct PokerGame {
    pub phase: GamePhase,
    pub pot: u64,
    pub deck: Deck,
    pub community_cards: Vec<Card>,
    pub players: Vec<PlayerState>,
    pub current_player_index: usize,
    pub winners: Vec<WinnerInfo>,
    /// Nombre de joueurs actifs ayant agi dans le tour courant sans relance depuis.
    /// Quand ce compteur atteint le nombre de joueurs actifs, le tour est terminé.
    actions_this_round: usize,
    /// Index du joueur qui a posé la dernière relance (pour savoir quand tout le monde a suivi).
    last_aggressor: Option<usize>,
}

#[derive(Clone, Debug)]
pub struct WinnerInfo {
    pub pseudo: String,
    pub amount_won: u64,
}

impl PokerGame {
    pub fn new() -> Self {
        Self {
            phase: GamePhase::WaitingForPlayers,
            pot: 0,
            deck: Deck::new_shuffled(),
            community_cards: Vec::new(),
            players: Vec::new(),
            current_player_index: 0,
            winners: Vec::new(),
            actions_this_round: 0,
            last_aggressor: None,
        }
    }

    pub fn add_player(&mut self, pseudo: String, starting_chips: u64) {
        // Autorise le join uniquement en attente OU si la main est terminée
        if self.phase == GamePhase::WaitingForPlayers || self.phase == GamePhase::Showdown {
            // Assigner le siège suivant disponible (séquentiellement, pas aléatoire)
            let next_seat = self.players.len() as u8;
            
            self.players.push(PlayerState {
                pseudo,
                chips: starting_chips,
                current_bet: 0,
                hole_cards: None,
                has_folded: false,
                seat: next_seat,
            });
        }
    }

    pub fn start_hand(&mut self) -> Result<(), &'static str> {
        if self.players.len() < 2 {
            return Err("Il faut au moins 2 joueurs pour commencer !");
        }

        self.phase = GamePhase::PreFlop;
        self.deck = Deck::new_shuffled();
        self.community_cards.clear();
        self.pot = 0;
        self.winners.clear();
        self.actions_this_round = 0;
        self.last_aggressor = None;

        // === ESPRESSO: Tirage de carte pour déterminer qui commence ===
        let mut card_values: Vec<(usize, u32)> = Vec::new();
        for (i, _player) in self.players.iter().enumerate() {
            if let Some(card) = self.deck.draw() {
                // Convertir la carte en valeur numérique pour comparaison
                let value = self.card_to_value(&card);
                card_values.push((i, value));
            }
        }
        
        // Trouver le joueur avec la plus haute carte
        let starting_player = card_values.iter()
            .max_by_key(|(_, value)| value)
            .map(|(idx, _)| *idx)
            .unwrap_or(0);

        self.current_player_index = starting_player;

        // === Réinitialiser le deck et distribuer les vraies cartes ===
        self.deck = Deck::new_shuffled();
        
        for player in self.players.iter_mut() {
            player.has_folded = false;
            player.current_bet = 0;
            if let (Some(c1), Some(c2)) = (self.deck.draw(), self.deck.draw()) {
                player.hole_cards = Some([c1, c2]);
            }
        }
        Ok(())
    }

    /// Convertit une carte en valeur pour l'espresso (comparaison)
    fn card_to_value(&self, card: &Card) -> u32 {
        // Utiliser les valeurs primes directement du Card
        card.prime_value()
    }

    pub fn process_action(&mut self, pseudo: &str, action: ClientMessage) -> Result<(), &'static str> {
        if let ClientMessage::StartGame = action {
            if self.phase == GamePhase::WaitingForPlayers || self.phase == GamePhase::Showdown {
                return self.start_hand();
            }
            return Err("La partie a déjà commencé !");
        }

        if self.phase == GamePhase::WaitingForPlayers || self.phase == GamePhase::Showdown {
            return Err("La partie n'est pas en cours !");
        }

        let highest_bet = self.players.iter().map(|p| p.current_bet).max().unwrap_or(0);

        // Vérifier que c'est bien le tour de ce joueur
        if self.players[self.current_player_index].pseudo != pseudo {
            return Err("Ce n'est pas ton tour !");
        }

        match action {
            ClientMessage::Fold => {
                self.players[self.current_player_index].has_folded = true;
                self.actions_this_round += 1;
            }
            ClientMessage::Check => {
                if self.players[self.current_player_index].current_bet < highest_bet {
                    return Err("Tu ne peux pas Check, tu dois Call ou Fold !");
                }
                self.actions_this_round += 1;
            }
            ClientMessage::Call => {
                let amount_to_call = highest_bet - self.players[self.current_player_index].current_bet;
                if self.players[self.current_player_index].chips < amount_to_call {
                    return Err("Fonds insuffisants pour suivre");
                }
                self.players[self.current_player_index].chips -= amount_to_call;
                self.players[self.current_player_index].current_bet += amount_to_call;
                self.pot += amount_to_call;
                self.actions_this_round += 1;
            }
            ClientMessage::Raise { amount } => {
                let amount_to_call = highest_bet - self.players[self.current_player_index].current_bet;
                let total_deduction = amount_to_call + amount;
                if self.players[self.current_player_index].chips < total_deduction {
                    return Err("Fonds insuffisants pour relancer");
                }
                self.players[self.current_player_index].chips -= total_deduction;
                self.players[self.current_player_index].current_bet += total_deduction;
                self.pot += total_deduction;
                // Une relance remet le compteur à 1 (seul le relanceur a agi depuis la relance)
                self.actions_this_round = 1;
                self.last_aggressor = Some(self.current_player_index);
            }
            _ => return Err("Action non valide"),
        }

        // Victoire immédiate si un seul joueur actif reste
        let active: Vec<usize> = self.players.iter().enumerate()
            .filter(|(_, p)| !p.has_folded)
            .map(|(i, _)| i)
            .collect();

        if active.len() == 1 {
            self.award_pot_to(&active);
            return Ok(());
        }

        self.advance_turn();
        Ok(())
    }

    pub fn advance_turn(&mut self) {
        let n = self.players.len();
        if n == 0 { return; }

        // Trouver le prochain joueur actif
        let mut next_idx = (self.current_player_index + 1) % n;
        let mut steps = 0;
        while self.players[next_idx].has_folded {
            next_idx = (next_idx + 1) % n;
            steps += 1;
            if steps >= n { break; }
        }
        self.current_player_index = next_idx;

        let active_count = self.players.iter().filter(|p| !p.has_folded).count();

        // Le tour est terminé quand tous les joueurs actifs ont agi depuis la dernière relance.
        // actions_this_round est remis à 1 à chaque Raise, donc quand il atteint active_count
        // tout le monde a eu l'occasion de parler après la dernière relance (ou en opener).
        if self.actions_this_round >= active_count && self.phase != GamePhase::Showdown {
            self.advance_phase();
        }
    }

    pub fn advance_phase(&mut self) {
        match self.phase {
            GamePhase::PreFlop => {
                self.phase = GamePhase::Flop;
                self.deal_community_cards(3);
                self.reset_bets_for_new_round();
            }
            GamePhase::Flop => {
                self.phase = GamePhase::Turn;
                self.deal_community_cards(1);
                self.reset_bets_for_new_round();
            }
            GamePhase::Turn => {
                self.phase = GamePhase::River;
                self.deal_community_cards(1);
                self.reset_bets_for_new_round();
            }
            GamePhase::River => {
                self.phase = GamePhase::Showdown;
                self.handle_showdown();
            }
            _ => {}
        }
    }

    pub fn deal_community_cards(&mut self, count: usize) {
        let _ = self.deck.draw(); // Burn
        for _ in 0..count {
            if let Some(c) = self.deck.draw() {
                self.community_cards.push(c);
            }
        }
    }

    pub fn reset_bets_for_new_round(&mut self) {
        for player in self.players.iter_mut() {
            player.current_bet = 0;
        }
        self.actions_this_round = 0;
        self.last_aggressor = None;
        // Premier joueur actif reprend la parole
        self.current_player_index = 0;
        while self.current_player_index < self.players.len()
            && self.players[self.current_player_index].has_folded
        {
            self.current_player_index += 1;
        }
        if self.current_player_index >= self.players.len() {
            self.current_player_index = 0;
        }
    }

    pub fn handle_showdown(&mut self) {
        let active: Vec<usize> = self.players.iter().enumerate()
            .filter(|(_, p)| !p.has_folded)
            .map(|(i, _)| i)
            .collect();

        if active.is_empty() { return; }

        self.award_pot_to(&active);
    }

    /// Distribue le pot aux gagnants, enregistre les WinnerInfo, et passe en Showdown.
    fn award_pot_to(&mut self, winner_indices: &[usize]) {
        let split_amount = self.pot / winner_indices.len() as u64;

        self.winners.clear();
        for &idx in winner_indices {
            self.players[idx].chips += split_amount;
            self.winners.push(WinnerInfo {
                pseudo: self.players[idx].pseudo.clone(),
                amount_won: split_amount,
            });
        }

        self.pot = 0;
        self.phase = GamePhase::Showdown;
    }
}