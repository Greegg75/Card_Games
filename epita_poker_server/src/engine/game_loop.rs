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
}

pub struct PokerGame {
    pub phase: GamePhase,
    pub pot: u64,
    pub deck: Deck,
    pub community_cards: Vec<Card>,
    pub players: Vec<PlayerState>,
    pub current_player_index: usize,
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
        }
    }

    pub fn add_player(&mut self, pseudo: String, starting_chips: u64) {
        if self.phase == GamePhase::WaitingForPlayers {
            self.players.push(PlayerState {
                pseudo,
                chips: starting_chips,
                current_bet: 0,
                hole_cards: None,
                has_folded: false,
            });
        }
    }

    pub fn start_hand(&mut self) -> Result<(), &'static str> {
        self.phase = GamePhase::PreFlop;
        self.deck = Deck::new_shuffled();
        self.community_cards.clear();
        self.pot = 0;
        self.current_player_index = 0;

        // Distribution
        for player in self.players.iter_mut() {
            player.has_folded = false;
            player.current_bet = 0;
            if let (Some(c1), Some(c2)) = (self.deck.draw(), self.deck.draw()) {
                player.hole_cards = Some([c1, c2]);
            }
        }
        Ok(())
    }

    pub fn process_action(&mut self, pseudo: &str, action: ClientMessage) -> Result<(), &'static str> {
        // 1. Gestion du démarrage de la partie
        if let ClientMessage::StartGame = action {
            if self.phase == GamePhase::WaitingForPlayers || self.phase == GamePhase::Showdown {
                return self.start_hand();
            }
            return Err("La partie a déjà commencé !");
        }

        // Sécurité : On empêche toute autre action si la partie n'a pas commencé
        if self.phase == GamePhase::WaitingForPlayers {
            return Err("La partie n'a pas encore commencé !");
        }

        // On calcule la mise la plus haute AVANT de verrouiller/modifier le joueur
        let highest_bet = self.players.iter().map(|p| p.current_bet).max().unwrap_or(0);

        let current_player = &mut self.players[self.current_player_index];
        if current_player.pseudo != pseudo {
            return Err("Ce n'est pas ton tour !");
        }

        // Appliquer l'action
        match action {
            ClientMessage::Fold => {
                current_player.has_folded = true;
            }
            ClientMessage::Check => {
                if current_player.current_bet < highest_bet {
                    return Err("Tu ne peux pas Check, tu dois Call ou Fold !");
                }
            }
            ClientMessage::Call => {
                let amount_to_call = highest_bet - current_player.current_bet;
                
                if current_player.chips < amount_to_call {
                    return Err("Fonds insuffisants pour suivre"); 
                }
                
                current_player.chips -= amount_to_call;
                current_player.current_bet += amount_to_call;
                self.pot += amount_to_call;
            }
            ClientMessage::Raise { amount } => {
                let amount_to_call = highest_bet - current_player.current_bet;
                let total_deduction = amount_to_call + amount;

                if current_player.chips < total_deduction {
                    return Err("Fonds insuffisants pour relancer");
                }
                
                current_player.chips -= total_deduction;
                current_player.current_bet += total_deduction;
                self.pot += total_deduction;
            }
            _ => return Err("Action non valide"),
        }

        self.advance_turn();
        Ok(())
    }

    // --- NOUVELLES FONCTIONS DE LOGIQUE ---

    /// Passe au joueur suivant, et avance de phase si tout le monde a misé
    pub fn advance_turn(&mut self) {
        let mut next_idx = (self.current_player_index + 1) % self.players.len();
        let start_idx = self.current_player_index;
        
        // Trouver le prochain joueur qui n'a pas passé
        while self.players[next_idx].has_folded && next_idx != start_idx {
            next_idx = (next_idx + 1) % self.players.len();
        }
        
        self.current_player_index = next_idx;

        // Vérifier si le tour de mise est terminé
        let active_players: Vec<_> = self.players.iter().filter(|p| !p.has_folded).collect();
        let highest_bet = active_players.iter().map(|p| p.current_bet).max().unwrap_or(0);
        
        let all_aligned = active_players.iter().all(|p| p.current_bet == highest_bet);
        
        if all_aligned {
            self.advance_phase();
        }
    }

    /// Avance la partie d'une étape à l'autre (Preflop -> Flop -> Turn -> River -> Showdown)
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

    /// Brûle une carte et distribue X cartes sur le board
    pub fn deal_community_cards(&mut self, count: usize) {
        let _ = self.deck.draw(); // Burn
        for _ in 0..count {
            if let Some(c) = self.deck.draw() {
                self.community_cards.push(c);
            }
        }
    }

    /// Réinitialise les mises de tout le monde au début d'un nouveau tour (ex: au Flop)
    pub fn reset_bets_for_new_round(&mut self) {
        for player in self.players.iter_mut() {
            player.current_bet = 0;
        }
        
        // Redonner la parole au premier joueur actif
        self.current_player_index = 0;
        while self.current_player_index < self.players.len() && self.players[self.current_player_index].has_folded {
            self.current_player_index += 1;
        }
        if self.current_player_index >= self.players.len() {
            self.current_player_index = 0;
        }
    }

    /// Gère la fin de la partie et distribue le pot
    pub fn handle_showdown(&mut self) {
        let active_players: Vec<usize> = self.players
            .iter()
            .enumerate()
            .filter(|(_, p)| !p.has_folded)
            .map(|(i, _)| i)
            .collect();

        if active_players.is_empty() {
            return; 
        }

        // Calcul du partage (Split Pot basique)
        let split_amount = self.pot / active_players.len() as u64;

        // Distribution des gains
        for &idx in &active_players {
            self.players[idx].chips += split_amount;
        }
    }
}