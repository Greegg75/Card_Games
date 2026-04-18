use super::cards::Card;
use rand::seq::SliceRandom;
use rand::thread_rng;

pub struct Deck {
    cards: Vec<Card>,
}

impl Deck {
    pub fn new_shuffled() -> Self {
        let mut cards = Vec::with_capacity(52);
        
        // 4 couleurs (shifts: 0, 1, 2, 3) et 13 rangs
        for suit in 0..4 {
            for rank in 0..13 {
                cards.push(Card::new(rank, suit));
            }
        }

        let mut deck = Deck { cards };
        deck.shuffle();
        deck
    }

    pub fn shuffle(&mut self) {
        let mut rng = thread_rng();
        self.cards.shuffle(&mut rng);
    }

    pub fn draw(&mut self) -> Option<Card> {
        self.cards.pop()
    }
}