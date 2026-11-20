use crate::cards::Card;
use std::cmp::Ordering;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HandValue {
    pub category: u8,
    pub kickers: Vec<u8>,
    pub best: Vec<Card>,
}

impl PartialOrd for HandValue {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for HandValue {
    fn cmp(&self, other: &Self) -> Ordering {
        self.category
            .cmp(&other.category)
            .then_with(|| self.kickers.cmp(&other.kickers))
    }
}

fn straight_high(mask: u16) -> Option<u8> {
    let mut m = mask;
    if m & (1 << 14) != 0 {
        m |= 1 << 1;
    }
    for high in (5..=14u8).rev() {
        let need: u16 = 0b11111 << (high - 4);
        if m & need == need {
            return Some(high);
        }
    }
    None
}

fn pick_rank(cards: &[Card], rank: u8, n: usize, used: &mut Vec<Card>) {
    let mut taken = 0;
    for c in cards {
        if taken == n {
            break;
        }
        if c.rank == rank && !used.contains(c) {
            used.push(*c);
            taken += 1;
        }
    }
}

fn pick_straight(cards: &[Card], high: u8, used: &mut Vec<Card>) {
    for i in 0..5u8 {
        let r = if high == 5 && i == 4 { 14 } else { high - i };
        pick_rank(cards, r, 1, used);
    }
}

pub fn evaluate(input: &[Card]) -> HandValue {
    let mut cards: Vec<Card> = input.to_vec();
    cards.sort_by(|a, b| b.rank.cmp(&a.rank));
    let mut counts = [0u8; 15];
    let mut suit_cards: [Vec<Card>; 4] = Default::default();
    let mut mask: u16 = 0;
    for c in &cards {
        counts[c.rank as usize] += 1;
        suit_cards[c.suit as usize].push(*c);
        mask |= 1 << c.rank;
    }

    for sc in suit_cards.iter() {
        if sc.len() >= 5 {
            let mut smask: u16 = 0;
            for c in sc {
                smask |= 1 << c.rank;
            }
            if let Some(h) = straight_high(smask) {
                let mut best = Vec::new();
                pick_straight(sc, h, &mut best);
                return HandValue { category: 8, kickers: vec![h], best };
            }
        }
    }

    let ranks_desc: Vec<u8> = (2..=14u8).rev().collect();
    let quads: Vec<u8> = ranks_desc.iter().copied().filter(|&r| counts[r as usize] == 4).collect();
    let trips: Vec<u8> = ranks_desc.iter().copied().filter(|&r| counts[r as usize] == 3).collect();
    let pairs: Vec<u8> = ranks_desc.iter().copied().filter(|&r| counts[r as usize] == 2).collect();

    if let Some(&q) = quads.first() {
        let mut best = Vec::new();
        pick_rank(&cards, q, 4, &mut best);
        let mut kickers = vec![q];
        if let Some(k) = cards.iter().find(|c| c.rank != q) {
            kickers.push(k.rank);
            best.push(*k);
        }
        return HandValue { category: 7, kickers, best };
    }

    if let Some(&t) = trips.first() {
        let pair = trips
            .iter()
            .skip(1)
            .chain(pairs.iter())
            .copied()
            .max();
        if let Some(p) = pair {
            let mut best = Vec::new();
            pick_rank(&cards, t, 3, &mut best);
            pick_rank(&cards, p, 2, &mut best);
            return HandValue { category: 6, kickers: vec![t, p], best };
        }
    }

    for sc in suit_cards.iter() {
        if sc.len() >= 5 {
            let best: Vec<Card> = sc.iter().take(5).copied().collect();
            let kickers = best.iter().map(|c| c.rank).collect();
            return HandValue { category: 5, kickers, best };
        }
    }

    if let Some(h) = straight_high(mask) {
        let mut best = Vec::new();
        pick_straight(&cards, h, &mut best);
        return HandValue { category: 4, kickers: vec![h], best };
    }

    if let Some(&t) = trips.first() {
        let mut best = Vec::new();
        pick_rank(&cards, t, 3, &mut best);
        let mut kickers = vec![t];
        for c in cards.iter().filter(|c| c.rank != t).take(2) {
            kickers.push(c.rank);
            best.push(*c);
        }
        return HandValue { category: 3, kickers, best };
    }

    if pairs.len() >= 2 {
        let (a, b) = (pairs[0], pairs[1]);
        let mut best = Vec::new();
        pick_rank(&cards, a, 2, &mut best);
        pick_rank(&cards, b, 2, &mut best);
        let mut kickers = vec![a, b];
        if let Some(k) = cards.iter().find(|c| c.rank != a && c.rank != b) {
            kickers.push(k.rank);
            best.push(*k);
        }
        return HandValue { category: 2, kickers, best };
    }

    if let Some(&p) = pairs.first() {
        let mut best = Vec::new();
        pick_rank(&cards, p, 2, &mut best);
        let mut kickers = vec![p];
        for c in cards.iter().filter(|c| c.rank != p).take(3) {
            kickers.push(c.rank);
            best.push(*c);
        }
        return HandValue { category: 1, kickers, best };
    }

    let best: Vec<Card> = cards.iter().take(5).copied().collect();
    let kickers = best.iter().map(|c| c.rank).collect();
    HandValue { category: 0, kickers, best }
}

fn singular(r: u8) -> &'static str {
    match r {
        14 => "As",
        13 => "Roi",
        12 => "Dame",
        11 => "Valet",
        10 => "Dix",
        9 => "Neuf",
        8 => "Huit",
        7 => "Sept",
        6 => "Six",
        5 => "Cinq",
        4 => "Quatre",
        3 => "Trois",
        _ => "Deux",
    }
}

fn plural(r: u8) -> &'static str {
    match r {
        14 => "As",
        13 => "Rois",
        12 => "Dames",
        11 => "Valets",
        10 => "Dix",
        9 => "Neuf",
        8 => "Huit",
        7 => "Sept",
        6 => "Six",
        5 => "Cinq",
        4 => "Quatre",
        3 => "Trois",
        _ => "Deux",
    }
}

fn de(r: u8) -> String {
    if r == 14 {
        "d'As".to_string()
    } else {
        format!("de {}", plural(r))
    }
}

pub fn describe(v: &HandValue) -> String {
    let k = |i: usize| v.kickers.get(i).copied().unwrap_or(2);
    match v.category {
        8 if k(0) == 14 => "Quinte flush royale".to_string(),
        8 => format!("Quinte flush hauteur {}", singular(k(0))),
        7 => format!("Carré {}", de(k(0))),
        6 => format!("Full aux {} par les {}", plural(k(0)), plural(k(1))),
        5 => format!("Couleur hauteur {}", singular(k(0))),
        4 => format!("Quinte hauteur {}", singular(k(0))),
        3 => format!("Brelan {}", de(k(0))),
        2 => format!("Double paire {} et {}", plural(k(0)), plural(k(1))),
        1 => format!("Paire {}", de(k(0))),
        _ => format!("Hauteur {}", singular(k(0))),
    }
}

pub fn display_category(v: &HandValue) -> u8 {
    if v.category == 8 && v.kickers.first() == Some(&14) {
        9
    } else {
        v.category
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(s: &str) -> Vec<Card> {
        s.split_whitespace()
            .map(|t| {
                let b = t.as_bytes();
                let rank = match b[0] {
                    b'A' => 14,
                    b'K' => 13,
                    b'Q' => 12,
                    b'J' => 11,
                    b'T' => 10,
                    d => d - b'0',
                };
                let suit = match b[1] {
                    b's' => 0,
                    b'h' => 1,
                    b'd' => 2,
                    _ => 3,
                };
                Card { rank, suit }
            })
            .collect()
    }

    #[test]
    fn categories() {
        assert_eq!(evaluate(&parse("As Ks Qs Js Ts 2d 3c")).category, 8);
        assert_eq!(evaluate(&parse("Ah 2h 3h 4h 5h Kd Kc")).kickers, vec![5]);
        assert_eq!(evaluate(&parse("9s 9h 9d 9c 2s 3h 4d")).category, 7);
        assert_eq!(evaluate(&parse("9s 9h 9d 2c 2s 3h 3d")).kickers, vec![9, 3]);
        assert_eq!(evaluate(&parse("9s 9h 9d 8c 8s 8h 3d")).kickers, vec![9, 8]);
        assert_eq!(evaluate(&parse("2s 7s 9s Js Ks Ad Ac")).category, 5);
        assert_eq!(evaluate(&parse("Ad 2c 3h 4s 5d Kc Qh")).kickers, vec![5]);
        assert_eq!(evaluate(&parse("Ad Ac 3h 4s 9d Kc Qh")).category, 1);
        assert_eq!(evaluate(&parse("Ad Ac 3h 3s 9d 9c Qh")).kickers, vec![14, 9, 12]);
        assert!(evaluate(&parse("Ad Kc")) > evaluate(&parse("Qd Jc")));
        assert_eq!(evaluate(&parse("Ad Ac")).category, 1);
        assert_eq!(evaluate(&parse("As Ks Qs Js Ts 2d 3c")).best.len(), 5);
    }
}
