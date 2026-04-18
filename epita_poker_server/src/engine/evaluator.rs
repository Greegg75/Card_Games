use crate::engine::cards::Card;

#[derive(Debug, PartialEq, PartialOrd, Eq, Ord)]
pub enum HandRank {
    HighCard,
    Pair,
    TwoPair,
    ThreeOfAKind,
    Straight,
    Flush,
    FullHouse,
    FourOfAKind,
    StraightFlush,
}

/// Évalue une main de 5 cartes et retourne son rang et un score pour départager
pub fn evaluate_5_cards(cards: &[Card; 5]) -> (HandRank, u32) {
    let mut flush = true;
    let mut prime_product: u32 = 1;
    let mut rank_bitmask: u32 = 0;

    // Shift de la première carte pour vérifier la couleur
    // Rappel: Is_suit prend un shift (0=Pique, 1=Coeur, 2=Carreau, 3=Trèfle)
    let first_suit = get_suit_shift(&cards[0]);

    for card in cards.iter() {
        prime_product *= card.prime_value();
        
        // rank_bitmask met à 1 le bit correspondant à la valeur de la carte
        // ex: Un As (rang 12) mettra le 12ème bit à 1.
        // Ça permet de vérifier facilement les quintes !
        let rank_index = get_rank_index(card);
        rank_bitmask |= 1 << rank_index;

        if !card.is_suit(first_suit) {
            flush = false;
        }
    }

    // Vérification de la Quinte (Straight)
    // Une quinte = 5 bits consécutifs à 1. 
    // Magie du bitwise : (bitmask / plus_petit_bit_à_1) == 0b11111 (soit 31 en décimal)
    let ls_bit = rank_bitmask & (!rank_bitmask + 1); // Isoler le bit de poids faible
    let mut is_straight = (rank_bitmask / ls_bit) == 31;

    // Cas spécial : La quinte blanche (As, 2, 3, 4, 5)
    // L'As est le bit 12, les 2,3,4,5 sont les bits 0,1,2,3 -> mask = 0b1000000001111 (4111)
    if rank_bitmask == 4111 {
        is_straight = true;
    }

    if is_straight && flush {
        return (HandRank::StraightFlush, rank_bitmask);
    } else if flush {
        return (HandRank::Flush, rank_bitmask);
    } else if is_straight {
        return (HandRank::Straight, rank_bitmask);
    }

    // Si ni couleur ni quinte, on utilise le produit des nombres premiers
    // pour identifier les paires, brelans, carrés, etc.
    let rank = match_prime_product(prime_product);
    
    (rank, prime_product)
}

// Helpers pour l'évaluateur

fn get_suit_shift(card: &Card) -> u8 {
    for i in 0..4 {
        if card.is_suit(i) { return i; }
    }
    0
}

fn get_rank_index(card: &Card) -> u32 {
    let primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41];
    let val = card.prime_value();
    primes.iter().position(|&p| p == val).unwrap() as u32
}

// Dans un moteur réel, on génère une Look-Up Table (LUT) parfaite pour ça.
// Ici, on simule l'idée : le produit des nombres premiers d'un Carré d'As (41*41*41*41 * kick)
// est mathématiquement unique.
fn match_prime_product(_product: u32) -> HandRank {
    // TODO: Implémenter la table de hashage mathématique.
    // Pour l'instant, on fallback sur HighCard pour que ça compile.
    HandRank::HighCard 
}