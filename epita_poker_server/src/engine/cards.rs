use std::fmt;

// Les nombres premiers assignés à chaque rang (2, 3, 4... As)
const PRIMES: [u32; 13] = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41];

#[derive(Clone, Copy, PartialEq, Eq)]
pub struct Card(u32);

impl Card {
    /// Crée une carte en utilisant le format binaire optimisé (style Cactus Kev)
    /// Bits: 00000000 00000000 0000cdhs 00pppppp
    /// c,d,h,s = couleurs (1 bit chacune), p = nombre premier
    pub fn new(rank: usize, suit_shift: u8) -> Self {
        let prime = PRIMES[rank];
        // On place le bit de la couleur (Pique, Coeur, Carreau, Trèfle)
        let suit_bits = 1 << suit_shift; 
        
        // Construction du u32
        let value = (suit_bits << 12) | prime;
        Card(value)
    }

    pub fn prime_value(&self) -> u32 {
        self.0 & 0xFF // Récupère les 8 premiers bits
    }

    pub fn is_suit(&self, suit_shift: u8) -> bool {
        (self.0 & (1 << (12 + suit_shift))) != 0
    }

    /// Transforme le bitset en chaîne de caractères (ex: "A♠", "K♥")
    pub fn to_string(&self) -> String {
        let primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41];
        let ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
        let suits = ["♠", "♥", "♦", "♣"];

        // Trouve l'index de la valeur (0 à 12)
        let rank_idx = primes.iter().position(|&p| p == self.prime_value()).unwrap_or(0);
        
        // Trouve la couleur
        let mut suit_idx = 0;
        for i in 0..4 {
            if self.is_suit(i) { suit_idx = i as usize; break; }
        }

        format!("{}{}", ranks[rank_idx], suits[suit_idx])
    }
}

// Juste pour pouvoir afficher les cartes dans la console lors des tests
impl fmt::Debug for Card {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Card({:032b})", self.0)
    }
}