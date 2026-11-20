use rand::seq::SliceRandom;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Card {
    pub rank: u8,
    pub suit: u8,
}

impl Card {
    pub fn code(&self) -> String {
        let r = match self.rank {
            14 => 'A',
            13 => 'K',
            12 => 'Q',
            11 => 'J',
            10 => 'T',
            n => (b'0' + n) as char,
        };
        let s = ['s', 'h', 'd', 'c'][self.suit as usize];
        format!("{}{}", r, s)
    }
}

pub fn codes(cards: &[Card]) -> Vec<String> {
    cards.iter().map(|c| c.code()).collect()
}

pub fn shuffled_decks(count: usize) -> Vec<Card> {
    let mut v = Vec::with_capacity(52 * count);
    for _ in 0..count {
        for suit in 0..4u8 {
            for rank in 2..=14u8 {
                v.push(Card { rank, suit });
            }
        }
    }
    v.shuffle(&mut rand::thread_rng());
    v
}
