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

/// Évalue une main de 5 cartes et retourne son rang + un score de départage (plus haut = meilleur).
pub fn evaluate_5_cards(cards: &[Card; 5]) -> (HandRank, u32) {
    let mut flush = true;
    let mut prime_product: u32 = 1;
    let mut rank_bitmask: u32 = 0;

    let first_suit = get_suit_shift(&cards[0]);

    for card in cards.iter() {
        prime_product = prime_product.saturating_mul(card.prime_value());
        let rank_index = get_rank_index(card);
        rank_bitmask |= 1 << rank_index;
        if !card.is_suit(first_suit) {
            flush = false;
        }
    }

    // Quinte : 5 bits consécutifs ou quinte basse As (A-2-3-4-5 = 0b1_0000_0000_1111 = 4111 en décimal... 
    // mais avec les bons bits : As=12, 2=0,3=1,4=2,5=3 -> (1<<12)|(1<<0)|(1<<1)|(1<<2)|(1<<3) = 4096+15 = 4111)
    let ls_bit = rank_bitmask & rank_bitmask.wrapping_neg();
    let is_straight_normal = rank_bitmask.count_ones() == 5 && (rank_bitmask / ls_bit) == 31;
    let is_wheel = rank_bitmask == 0b1_0000_0000_1111; // A-2-3-4-5
    let is_straight = is_straight_normal || is_wheel;

    if is_straight && flush {
        return (HandRank::StraightFlush, rank_bitmask);
    }
    if flush {
        return (HandRank::Flush, rank_bitmask);
    }
    if is_straight {
        // La quinte basse vaut moins : on lui donne un score inférieur
        let score = if is_wheel { 14u32 } else { rank_bitmask };
        return (HandRank::Straight, score);
    }

    let (rank, score) = classify_by_prime_product(prime_product, rank_bitmask);
    (rank, score)
}

fn get_suit_shift(card: &Card) -> u8 {
    for i in 0..4 {
        if card.is_suit(i) { return i; }
    }
    0
}

fn get_rank_index(card: &Card) -> u32 {
    let primes = [2u32, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41];
    let val = card.prime_value();
    primes.iter().position(|&p| p == val).unwrap_or(0) as u32
}

/// Détermine la combinaison via les comptes de cartes par rang.
/// Le produit de nombres premiers garantit une factorisation unique.
fn classify_by_prime_product(_product: u32, rank_bitmask: u32) -> (HandRank, u32) {
    let primes = [2u32, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41];

    // Compte combien de fois chaque rang apparaît dans la main
    // (en refactorisant le produit — O(13) max, parfaitement acceptable)
    let mut counts = [0u8; 13];
    let mut remaining = _product;
    for (i, &p) in primes.iter().enumerate() {
        while remaining % p == 0 {
            counts[i] += 1;
            remaining /= p;
        }
    }

    let mut fours = 0u32;
    let mut threes = 0u32;
    let mut twos = 0u32;
    let mut four_rank = 0u32;
    let mut three_rank = 0u32;
    let mut pair_ranks: Vec<u32> = Vec::new();

    for (i, &c) in counts.iter().enumerate() {
        let rank_bit = 1u32 << i;
        match c {
            4 => { fours += 1; four_rank = rank_bit; }
            3 => { threes += 1; three_rank = rank_bit; }
            2 => { twos += 1; pair_ranks.push(rank_bit); }
            _ => {}
        }
    }

    // Score de départage : on met le rang fort en poids fort
    if fours == 1 {
        return (HandRank::FourOfAKind, four_rank << 16 | rank_bitmask);
    }
    if threes == 1 && twos == 1 {
        return (HandRank::FullHouse, three_rank << 16 | *pair_ranks.first().unwrap_or(&0));
    }
    if twos == 2 {
        let high_pair = pair_ranks.iter().max().copied().unwrap_or(0);
        let low_pair  = pair_ranks.iter().min().copied().unwrap_or(0);
        return (HandRank::TwoPair, high_pair << 16 | low_pair << 8 | rank_bitmask);
    }
    if threes == 1 {
        return (HandRank::ThreeOfAKind, three_rank << 16 | rank_bitmask);
    }
    if twos == 1 {
        let pair_rank = pair_ranks[0];
        return (HandRank::Pair, pair_rank << 16 | rank_bitmask);
    }

    // Carte haute : le score est simplement le bitmask (bit le plus haut = meilleur)
    (HandRank::HighCard, rank_bitmask)
}