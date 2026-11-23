use crate::cards::{shuffled_decks, Card};
use crate::hub::{Hub, Out, TableCmd};
use crate::protocol::{BjHandView, BjSeatView, BjView, ServerMsg, TableSummary};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::mpsc::UnboundedReceiver;
use tokio::time::{sleep_until, Duration, Instant};

const BET_MS: u64 = 15_000;
const QUICK_START_MS: u64 = 2_500;
const TURN_MS: u64 = 20_000;
const DEALER_STEP_MS: u64 = 900;
const RESULT_MS: u64 = 5_500;
const DECKS: usize = 6;

pub struct BjConfig {
    pub id: String,
    pub name: String,
    pub theme: &'static str,
    pub min_bet: u64,
    pub max_bet: u64,
    pub seats: usize,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Phase {
    Waiting,
    Betting,
    Playing,
    Dealer,
    Results,
}

impl Phase {
    fn name(&self) -> &'static str {
        match self {
            Phase::Waiting => "waiting",
            Phase::Betting => "betting",
            Phase::Playing => "playing",
            Phase::Dealer => "dealer",
            Phase::Results => "results",
        }
    }
}

struct Hand {
    cards: Vec<Card>,
    bet: u64,
    doubled: bool,
    done: bool,
    from_split: bool,
    result: Option<String>,
    payout: u64,
}

impl Hand {
    fn new(bet: u64, from_split: bool) -> Self {
        Self { cards: Vec::new(), bet, doubled: false, done: false, from_split, result: None, payout: 0 }
    }

    fn is_blackjack(&self) -> bool {
        !self.from_split && self.cards.len() == 2 && value(&self.cards).0 == 21
    }
}

struct Seat {
    cid: u64,
    name: String,
    bet: u64,
    last_bet: u64,
    hands: Vec<Hand>,
    leaving: bool,
}

struct Watcher {
    name: String,
    out: Out,
}

fn card_points(c: &Card) -> u8 {
    match c.rank {
        14 => 1,
        r if r >= 10 => 10,
        r => r,
    }
}

pub fn value(cards: &[Card]) -> (u8, bool) {
    let mut total: u8 = 0;
    let mut ace = false;
    for c in cards {
        total += card_points(c);
        if c.rank == 14 {
            ace = true;
        }
    }
    if ace && total + 10 <= 21 {
        (total + 10, true)
    } else {
        (total, false)
    }
}

fn value_label(cards: &[Card], from_split: bool) -> String {
    if cards.is_empty() {
        return String::new();
    }
    let (t, soft) = value(cards);
    if !from_split && cards.len() == 2 && t == 21 {
        return "BJ".into();
    }
    if soft && t < 21 {
        format!("{}/{}", t - 10, t)
    } else {
        t.to_string()
    }
}

pub struct BlackjackTable {
    cfg: BjConfig,
    hub: Arc<Hub>,
    watchers: HashMap<u64, Watcher>,
    seats: Vec<Option<Seat>>,
    phase: Phase,
    shoe: Vec<Card>,
    dealer: Vec<Card>,
    hole_hidden: bool,
    turn: Option<(usize, usize)>,
    deadline: Option<Instant>,
    timer_total: u64,
    round_no: u64,
    log: VecDeque<String>,
}

impl BlackjackTable {
    pub fn new(cfg: BjConfig, hub: Arc<Hub>) -> Self {
        let n = cfg.seats;
        Self {
            cfg,
            hub,
            watchers: HashMap::new(),
            seats: (0..n).map(|_| None).collect(),
            phase: Phase::Waiting,
            shoe: shuffled_decks(DECKS),
            dealer: Vec::new(),
            hole_hidden: false,
            turn: None,
            deadline: None,
            timer_total: 0,
            round_no: 0,
            log: VecDeque::new(),
        }
    }

    pub fn summary(&self) -> TableSummary {
        TableSummary {
            id: self.cfg.id.clone(),
            game: "blackjack",
            name: self.cfg.name.clone(),
            theme: self.cfg.theme,
            stakes: format!("{} - {}", self.cfg.min_bet, self.cfg.max_bet),
            small_blind: 0,
            big_blind: 0,
            min_buy: 0,
            max_buy: 0,
            min_bet: self.cfg.min_bet,
            max_bet: self.cfg.max_bet,
            seats: self.cfg.seats,
            players: self.seats.iter().filter(|s| s.is_some()).count(),
            watchers: self.watchers.len(),
        }
    }

    pub async fn run(mut self, mut rx: UnboundedReceiver<TableCmd>) {
        loop {
            let deadline = self.deadline;
            tokio::select! {
                cmd = rx.recv() => match cmd {
                    Some(c) => self.handle(c),
                    None => break,
                },
                _ = async move {
                    match deadline {
                        Some(d) => sleep_until(d).await,
                        None => std::future::pending::<()>().await,
                    }
                } => self.on_timer(),
            }
            self.broadcast();
            self.hub.set_summary(self.summary());
        }
    }

    fn push_log(&mut self, s: String) {
        self.log.push_back(s);
        while self.log.len() > 40 {
            self.log.pop_front();
        }
    }

    fn send_to(&self, cid: u64, msg: ServerMsg) {
        if let Some(w) = self.watchers.get(&cid) {
            let _ = w.out.send(msg);
        }
    }

    fn error(&self, cid: u64, msg: impl Into<String>) {
        self.send_to(cid, ServerMsg::Error { msg: msg.into() });
    }

    fn send_balance(&self, cid: u64, name: &str) {
        self.send_to(cid, ServerMsg::Balance { balance: self.hub.wallets.balance(name) });
    }

    fn seat_of(&self, cid: u64) -> Option<usize> {
        self.seats
            .iter()
            .position(|s| s.as_ref().map(|s| s.cid == cid).unwrap_or(false))
    }

    fn set_timer(&mut self, ms: u64) {
        self.deadline = Some(Instant::now() + Duration::from_millis(crate::hub::scaled(ms)));
        self.timer_total = ms;
    }

    fn draw(&mut self) -> Card {
        if self.shoe.is_empty() {
            self.shoe = shuffled_decks(DECKS);
        }
        self.shoe.pop().unwrap()
    }

    fn handle(&mut self, cmd: TableCmd) {
        let res = match cmd {
            TableCmd::Join { cid, name, out } => {
                self.watchers.insert(cid, Watcher { name, out });
                Ok(())
            }
            TableCmd::Leave { cid } => {
                self.remove_player(cid);
                self.watchers.remove(&cid);
                Ok(())
            }
            TableCmd::Stand { cid } => {
                self.remove_player(cid);
                Ok(())
            }
            TableCmd::Sit { cid, seat, .. } => self.sit(cid, seat).map_err(|e| (cid, e)),
            TableCmd::Bet { cid, amount } => self.bet(cid, amount).map_err(|e| (cid, e)),
            TableCmd::Act { cid, kind, .. } => self.act(cid, &kind).map_err(|e| (cid, e)),
            TableCmd::Chat { cid, text } => {
                let text: String = text.trim().chars().take(200).collect();
                if let (false, Some(w)) = (text.is_empty(), self.watchers.get(&cid)) {
                    let msg = ServerMsg::Chat { from: w.name.clone(), text };
                    for w in self.watchers.values() {
                        let _ = w.out.send(msg.clone());
                    }
                }
                Ok(())
            }
        };
        if let Err((cid, e)) = res {
            self.error(cid, e);
        }
    }

    fn sit(&mut self, cid: u64, seat: usize) -> Result<(), String> {
        let name = self.watchers.get(&cid).ok_or("Join the table first")?.name.clone();
        if self.seat_of(cid).is_some() {
            return Err("You are already seated".into());
        }
        if seat >= self.seats.len() || self.seats[seat].is_some() {
            return Err("This seat is taken".into());
        }
        self.seats[seat] = Some(Seat { cid, name: name.clone(), bet: 0, last_bet: 0, hands: Vec::new(), leaving: false });
        self.push_log(format!("{} joins the table", name));
        Ok(())
    }

    fn remove_player(&mut self, cid: u64) {
        let Some(i) = self.seat_of(cid) else { return };
        let in_round = matches!(self.phase, Phase::Playing | Phase::Dealer);
        let s = self.seats[i].as_mut().unwrap();
        if s.bet > 0 {
            let (name, bet) = (s.name.clone(), s.bet);
            s.bet = 0;
            self.hub.wallets.give(&name, bet);
            self.send_balance(cid, &name);
        }
        let s = self.seats[i].as_mut().unwrap();
        let name = s.name.clone();
        if in_round && !s.hands.is_empty() {
            s.leaving = true;
            s.cid = 0;
            for h in s.hands.iter_mut() {
                if !h.done {
                    h.done = true;
                    h.result = Some("Forfeit".into());
                }
            }
            if self.turn.map(|t| t.0) == Some(i) {
                self.advance();
            }
        } else {
            self.seats[i] = None;
        }
        self.push_log(format!("{} leaves the table", name));
        if self.phase == Phase::Betting && !self.seats.iter().flatten().any(|s| s.bet > 0) {
            self.phase = Phase::Waiting;
            self.deadline = None;
        }
    }

    fn bet(&mut self, cid: u64, amount: u64) -> Result<(), String> {
        let i = self.seat_of(cid).ok_or("Take a seat to bet")?;
        if !matches!(self.phase, Phase::Waiting | Phase::Betting) {
            return Err("Betting is closed".into());
        }
        if amount == 0 {
            return Err("Invalid bet".into());
        }
        let s = self.seats[i].as_ref().unwrap();
        if s.bet + amount > self.cfg.max_bet {
            return Err(format!("Maximum bet: {}", self.cfg.max_bet));
        }
        let name = s.name.clone();
        if !self.hub.wallets.take(&name, amount) {
            return Err("Insufficient balance".into());
        }
        self.seats[i].as_mut().unwrap().bet += amount;
        self.send_balance(cid, &name);
        if self.phase == Phase::Waiting {
            self.phase = Phase::Betting;
            self.set_timer(BET_MS);
        }
        self.check_quick_start();
        Ok(())
    }

    fn check_quick_start(&mut self) {
        let seated: Vec<&Seat> = self.seats.iter().flatten().collect();
        if !seated.is_empty() && seated.iter().all(|s| s.bet >= self.cfg.min_bet) {
            let quick = Instant::now() + Duration::from_millis(crate::hub::scaled(QUICK_START_MS));
            if self.deadline.map(|d| d > quick).unwrap_or(true) {
                self.deadline = Some(quick);
                self.timer_total = QUICK_START_MS;
            }
        }
    }

    fn act(&mut self, cid: u64, kind: &str) -> Result<(), String> {
        let i = self.seat_of(cid).ok_or("You are not seated")?;
        match kind {
            "clear" => {
                if !matches!(self.phase, Phase::Waiting | Phase::Betting) {
                    return Err("Betting is closed".into());
                }
                let s = self.seats[i].as_mut().unwrap();
                let (name, bet) = (s.name.clone(), s.bet);
                s.bet = 0;
                self.hub.wallets.give(&name, bet);
                self.send_balance(cid, &name);
                if !self.seats.iter().flatten().any(|s| s.bet > 0) {
                    self.phase = Phase::Waiting;
                    self.deadline = None;
                }
                Ok(())
            }
            "rebet" => {
                let last = self.seats[i].as_ref().unwrap().last_bet;
                if last == 0 {
                    return Err("No previous bet".into());
                }
                self.bet(cid, last)
            }
            "hit" | "stand" | "double" | "split" => self.play(i, kind),
            _ => Err("Unknown action".into()),
        }
    }

    fn play(&mut self, i: usize, kind: &str) -> Result<(), String> {
        let Some((ti, hi)) = self.turn else { return Err("It's not your turn".into()) };
        if ti != i || self.phase != Phase::Playing {
            return Err("It's not your turn".into());
        }
        let name = self.seats[i].as_ref().unwrap().name.clone();
        let cid = self.seats[i].as_ref().unwrap().cid;
        match kind {
            "hit" => {
                let c = self.draw();
                let h = &mut self.seats[i].as_mut().unwrap().hands[hi];
                h.cards.push(c);
                if value(&h.cards).0 >= 21 {
                    h.done = true;
                }
                self.push_log(format!("{} hits", name));
            }
            "stand" => {
                self.seats[i].as_mut().unwrap().hands[hi].done = true;
                self.push_log(format!("{} stands", name));
            }
            "double" => {
                let h = &self.seats[i].as_ref().unwrap().hands[hi];
                if h.cards.len() != 2 {
                    return Err("You can only double down on two cards".into());
                }
                let bet = h.bet;
                if !self.hub.wallets.take(&name, bet) {
                    return Err("Insufficient balance to double down".into());
                }
                let c = self.draw();
                let h = &mut self.seats[i].as_mut().unwrap().hands[hi];
                h.bet += bet;
                h.doubled = true;
                h.cards.push(c);
                h.done = true;
                self.send_balance(cid, &name);
                self.push_log(format!("{} doubles down", name));
            }
            "split" => {
                let s = self.seats[i].as_ref().unwrap();
                let h = &s.hands[hi];
                if h.cards.len() != 2 || card_points(&h.cards[0]) != card_points(&h.cards[1]) {
                    return Err("These cards cannot be split".into());
                }
                if s.hands.len() >= 4 {
                    return Err("Maximum number of hands reached".into());
                }
                let bet = h.bet;
                if !self.hub.wallets.take(&name, bet) {
                    return Err("Insufficient balance to split".into());
                }
                let aces = h.cards[0].rank == 14;
                let c1 = self.draw();
                let c2 = self.draw();
                let s = self.seats[i].as_mut().unwrap();
                let second = s.hands[hi].cards.pop().unwrap();
                let mut nh = Hand::new(bet, true);
                nh.cards.push(second);
                nh.cards.push(c2);
                let h = &mut s.hands[hi];
                h.from_split = true;
                h.cards.push(c1);
                if aces {
                    h.done = true;
                    nh.done = true;
                }
                if value(&h.cards).0 == 21 {
                    h.done = true;
                }
                if value(&nh.cards).0 == 21 {
                    nh.done = true;
                }
                s.hands.insert(hi + 1, nh);
                self.send_balance(cid, &name);
                self.push_log(format!("{} splits", name));
            }
            _ => unreachable!(),
        }
        if self.seats[i].as_ref().unwrap().hands[hi].done {
            self.advance();
        } else {
            self.set_timer(TURN_MS);
        }
        Ok(())
    }

    fn on_timer(&mut self) {
        self.deadline = None;
        match self.phase {
            Phase::Betting => self.deal_round(),
            Phase::Playing => {
                if let Some((i, h)) = self.turn {
                    if let Some(s) = self.seats[i].as_mut() {
                        s.hands[h].done = true;
                    }
                    self.advance();
                }
            }
            Phase::Dealer => self.dealer_step(),
            Phase::Results => self.reset_round(),
            Phase::Waiting => {}
        }
    }

    fn deal_round(&mut self) {
        if self.shoe.len() < DECKS * 52 / 4 {
            self.shoe = shuffled_decks(DECKS);
            self.push_log("New shoe shuffled".into());
        }
        let min = self.cfg.min_bet;
        let mut refunds = Vec::new();
        for s in self.seats.iter_mut().flatten() {
            if s.bet > 0 && s.bet < min {
                refunds.push((s.cid, s.name.clone(), s.bet));
                s.bet = 0;
            }
        }
        for (cid, name, bet) in refunds {
            self.hub.wallets.give(&name, bet);
            self.send_balance(cid, &name);
            self.error(cid, format!("Minimum bet: {} — bet refunded", min));
        }
        let players: Vec<usize> = (0..self.seats.len())
            .filter(|&i| self.seats[i].as_ref().map(|s| s.bet > 0).unwrap_or(false))
            .collect();
        if players.is_empty() {
            self.phase = Phase::Waiting;
            return;
        }
        self.round_no += 1;
        self.dealer.clear();
        for &i in &players {
            let s = self.seats[i].as_mut().unwrap();
            s.hands = vec![Hand::new(s.bet, false)];
            s.last_bet = s.bet;
            s.bet = 0;
        }
        for _ in 0..2 {
            for &i in &players {
                let c = self.draw();
                self.seats[i].as_mut().unwrap().hands[0].cards.push(c);
            }
            let c = self.draw();
            self.dealer.push(c);
        }
        self.hole_hidden = true;
        self.phase = Phase::Playing;
        self.push_log(format!("— Round #{} —", self.round_no));
        for &i in &players {
            let h = &mut self.seats[i].as_mut().unwrap().hands[0];
            if value(&h.cards).0 == 21 {
                h.done = true;
            }
        }
        let up = card_points(&self.dealer[0]);
        if (up == 1 || up == 10) && value(&self.dealer).0 == 21 {
            self.hole_hidden = false;
            self.push_log("Dealer has Blackjack".into());
            self.settle();
            return;
        }
        self.turn = None;
        self.advance();
    }

    fn advance(&mut self) {
        let n = self.seats.len();
        let (start_seat, start_hand) = match self.turn {
            Some((s, h)) => (s, h + 1),
            None => (0, 0),
        };
        for si in start_seat..n {
            if let Some(s) = &self.seats[si] {
                let from = if si == start_seat { start_hand } else { 0 };
                for hi in from..s.hands.len() {
                    if !s.hands[hi].done {
                        self.turn = Some((si, hi));
                        self.set_timer(TURN_MS);
                        return;
                    }
                }
            }
        }
        self.turn = None;
        self.start_dealer();
    }

    fn start_dealer(&mut self) {
        self.phase = Phase::Dealer;
        self.hole_hidden = false;
        let needs_draw = self.seats.iter().flatten().any(|s| {
            s.hands
                .iter()
                .any(|h| value(&h.cards).0 <= 21 && !h.is_blackjack() && h.result.is_none())
        });
        if !needs_draw {
            self.settle();
            return;
        }
        self.set_timer(DEALER_STEP_MS);
    }

    fn dealer_step(&mut self) {
        if value(&self.dealer).0 < 17 {
            let c = self.draw();
            self.dealer.push(c);
            self.set_timer(DEALER_STEP_MS);
        } else {
            self.settle();
        }
    }

    fn settle(&mut self) {
        let (dt, _) = value(&self.dealer);
        let dealer_bj = self.dealer.len() == 2 && dt == 21;
        let dealer_bust = dt > 21;
        let mut payouts: Vec<(u64, String, u64)> = Vec::new();
        for s in self.seats.iter_mut().flatten() {
            let mut total = 0;
            for h in s.hands.iter_mut() {
                h.done = true;
                if h.result.is_some() {
                    continue;
                }
                let (pt, _) = value(&h.cards);
                let bj = h.is_blackjack();
                let (res, pay) = if pt > 21 {
                    ("Bust", 0)
                } else if dealer_bj {
                    if bj {
                        ("Push", h.bet)
                    } else {
                        ("Lose", 0)
                    }
                } else if bj {
                    ("Blackjack", h.bet * 5 / 2)
                } else if dealer_bust || pt > dt {
                    ("Win", h.bet * 2)
                } else if pt == dt {
                    ("Push", h.bet)
                } else {
                    ("Lose", 0)
                };
                h.result = Some(res.to_string());
                h.payout = pay;
                total += pay;
            }
            if !s.leaving {
                payouts.push((s.cid, s.name.clone(), total));
            } else if total > 0 {
                payouts.push((0, s.name.clone(), total));
            }
        }
        for (cid, name, total) in payouts {
            self.hub.wallets.give(&name, total);
            if cid != 0 {
                self.send_balance(cid, &name);
            }
            if total > 0 {
                self.push_log(format!("{} collects {}", name, total));
            }
        }
        self.turn = None;
        self.phase = Phase::Results;
        self.set_timer(RESULT_MS);
    }

    fn reset_round(&mut self) {
        for slot in self.seats.iter_mut() {
            if slot.as_ref().map(|s| s.leaving).unwrap_or(false) {
                *slot = None;
            } else if let Some(s) = slot.as_mut() {
                s.hands.clear();
            }
        }
        self.dealer.clear();
        self.hole_hidden = false;
        self.phase = Phase::Waiting;
        self.deadline = None;
        if self.seats.iter().flatten().any(|s| s.bet > 0) {
            self.phase = Phase::Betting;
            self.set_timer(BET_MS);
            self.check_quick_start();
        }
    }

    fn view_for(&self, cid: u64, now: Instant) -> BjView {
        let you = self.seat_of(cid);
        let dealer_cards: Vec<String> = if self.hole_hidden && self.dealer.len() == 2 {
            vec![self.dealer[0].code(), "??".into()]
        } else {
            self.dealer.iter().map(|c| c.code()).collect()
        };
        let dealer_value = if self.dealer.is_empty() {
            None
        } else if self.hole_hidden {
            Some(value_label(&self.dealer[..1], true))
        } else {
            Some(value_label(&self.dealer, false))
        };
        let seats = self
            .seats
            .iter()
            .map(|s| {
                s.as_ref().map(|s| BjSeatView {
                    name: s.name.clone(),
                    bet: s.bet,
                    last_bet: s.last_bet,
                    leaving: s.leaving,
                    hands: s
                        .hands
                        .iter()
                        .map(|h| BjHandView {
                            cards: h.cards.iter().map(|c| c.code()).collect(),
                            bet: h.bet,
                            value: value_label(&h.cards, h.from_split),
                            total: value(&h.cards).0,
                            doubled: h.doubled,
                            done: h.done,
                            result: h.result.clone(),
                            payout: h.payout,
                        })
                        .collect(),
                })
            })
            .collect();
        let (mut can_double, mut can_split) = (false, false);
        if let (Some(y), Some((ti, hi))) = (you, self.turn) {
            if y == ti && self.phase == Phase::Playing {
                let s = self.seats[y].as_ref().unwrap();
                let h = &s.hands[hi];
                let bal = self.hub.wallets.balance(&s.name);
                can_double = h.cards.len() == 2 && bal >= h.bet;
                can_split = h.cards.len() == 2
                    && card_points(&h.cards[0]) == card_points(&h.cards[1])
                    && s.hands.len() < 4
                    && bal >= h.bet;
            }
        }
        BjView {
            table: self.summary(),
            phase: self.phase.name().to_string(),
            round_no: self.round_no,
            timer_ms: self.deadline.map(|d| d.saturating_duration_since(now).as_millis() as u64),
            timer_total_ms: self.timer_total,
            dealer_cards,
            dealer_value,
            seats,
            turn_seat: self.turn.map(|t| t.0),
            turn_hand: self.turn.map(|t| t.1),
            you,
            can_double,
            can_split,
            shoe_left: self.shoe.len(),
            log: self.log.iter().cloned().collect(),
        }
    }

    fn broadcast(&mut self) {
        let now = Instant::now();
        let mut dead = Vec::new();
        for (&cid, w) in &self.watchers {
            let v = self.view_for(cid, now);
            if w.out.send(ServerMsg::Blackjack { state: Box::new(v) }).is_err() {
                dead.push(cid);
            }
        }
        for cid in dead {
            self.watchers.remove(&cid);
        }
    }
}
