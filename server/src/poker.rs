use crate::cards::{codes, shuffled_decks, Card};
use crate::eval::{describe, display_category, evaluate, HandValue};
use crate::hub::{Hub, Out, TableCmd};
use crate::protocol::{PokerSeatView, PokerView, PokerWinner, ServerMsg, TableSummary};
use std::cmp::Ordering;
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::mpsc::UnboundedReceiver;
use tokio::time::{sleep_until, Duration, Instant};

const ACTION_MS: u64 = 25_000;
const START_MS: u64 = 3_000;
const SHOWDOWN_MS: u64 = 7_000;
const UNCONTESTED_MS: u64 = 3_500;
const MAX_TIMEOUTS: u8 = 3;

pub struct PokerConfig {
    pub id: String,
    pub name: String,
    pub theme: &'static str,
    pub sb: u64,
    pub bb: u64,
    pub min_buy: u64,
    pub max_buy: u64,
    pub seats: usize,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Phase {
    Waiting,
    Preflop,
    Flop,
    Turn,
    River,
    Showdown,
}

impl Phase {
    fn name(&self) -> &'static str {
        match self {
            Phase::Waiting => "waiting",
            Phase::Preflop => "preflop",
            Phase::Flop => "flop",
            Phase::Turn => "turn",
            Phase::River => "river",
            Phase::Showdown => "showdown",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Timer {
    None,
    Action,
    NextHand,
}

struct Seat {
    cid: u64,
    name: String,
    stack: u64,
    hole: Vec<Card>,
    in_hand: bool,
    folded: bool,
    all_in: bool,
    bet: u64,
    committed: u64,
    acted: bool,
    last_action: Option<String>,
    revealed: bool,
    hand_name: Option<String>,
    leaving: bool,
    timeouts: u8,
}

impl Seat {
    fn new(cid: u64, name: String, stack: u64) -> Self {
        Self {
            cid,
            name,
            stack,
            hole: Vec::new(),
            in_hand: false,
            folded: false,
            all_in: false,
            bet: 0,
            committed: 0,
            acted: false,
            last_action: None,
            revealed: false,
            hand_name: None,
            leaving: false,
            timeouts: 0,
        }
    }

    fn reset(&mut self) {
        self.hole.clear();
        self.in_hand = false;
        self.folded = false;
        self.all_in = false;
        self.bet = 0;
        self.committed = 0;
        self.acted = false;
        self.last_action = None;
        self.revealed = false;
        self.hand_name = None;
    }
}

struct Watcher {
    name: String,
    out: Out,
}

struct Pot {
    amount: u64,
    eligible: Vec<usize>,
}

pub struct PokerTable {
    cfg: PokerConfig,
    hub: Arc<Hub>,
    watchers: HashMap<u64, Watcher>,
    seats: Vec<Option<Seat>>,
    phase: Phase,
    deck: Vec<Card>,
    board: Vec<Card>,
    button: Option<usize>,
    sb_seat: Option<usize>,
    bb_seat: Option<usize>,
    to_act: Option<usize>,
    current_bet: u64,
    min_raise: u64,
    dead: u64,
    deadline: Option<Instant>,
    timer: Timer,
    winners: Vec<PokerWinner>,
    pots_view: Vec<u64>,
    hand_no: u64,
    log: VecDeque<String>,
}

impl PokerTable {
    pub fn new(cfg: PokerConfig, hub: Arc<Hub>) -> Self {
        let n = cfg.seats;
        Self {
            cfg,
            hub,
            watchers: HashMap::new(),
            seats: (0..n).map(|_| None).collect(),
            phase: Phase::Waiting,
            deck: Vec::new(),
            board: Vec::new(),
            button: None,
            sb_seat: None,
            bb_seat: None,
            to_act: None,
            current_bet: 0,
            min_raise: 0,
            dead: 0,
            deadline: None,
            timer: Timer::None,
            winners: Vec::new(),
            pots_view: Vec::new(),
            hand_no: 0,
            log: VecDeque::new(),
        }
    }

    pub fn summary(&self) -> TableSummary {
        TableSummary {
            id: self.cfg.id.clone(),
            game: "poker",
            name: self.cfg.name.clone(),
            theme: self.cfg.theme,
            stakes: format!("{}/{}", self.cfg.sb, self.cfg.bb),
            small_blind: self.cfg.sb,
            big_blind: self.cfg.bb,
            min_buy: self.cfg.min_buy,
            max_buy: self.cfg.max_buy,
            min_bet: 0,
            max_bet: 0,
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

    fn n(&self) -> usize {
        self.seats.len()
    }

    fn seat(&self, i: usize) -> &Seat {
        self.seats[i].as_ref().unwrap()
    }

    fn seat_mut(&mut self, i: usize) -> &mut Seat {
        self.seats[i].as_mut().unwrap()
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

    fn hand_running(&self) -> bool {
        matches!(self.phase, Phase::Preflop | Phase::Flop | Phase::Turn | Phase::River)
    }

    fn set_timer(&mut self, t: Timer, ms: u64) {
        self.timer = t;
        self.deadline = Some(Instant::now() + Duration::from_millis(crate::hub::scaled(ms)));
    }

    fn clear_timer(&mut self) {
        self.timer = Timer::None;
        self.deadline = None;
    }

    fn handle(&mut self, cmd: TableCmd) {
        match cmd {
            TableCmd::Join { cid, name, out } => {
                self.watchers.insert(cid, Watcher { name, out });
            }
            TableCmd::Leave { cid } => {
                self.remove_player(cid);
                self.watchers.remove(&cid);
            }
            TableCmd::Stand { cid } => self.remove_player(cid),
            TableCmd::Sit { cid, seat, buy_in } => {
                if let Err(e) = self.sit(cid, seat, buy_in) {
                    self.error(cid, e);
                }
            }
            TableCmd::Act { cid, kind, amount } => {
                if let Err(e) = self.act(cid, &kind, amount) {
                    self.error(cid, e);
                }
            }
            TableCmd::Bet { cid, .. } => self.error(cid, "Unknown poker action"),
            TableCmd::Chat { cid, text } => {
                let text: String = text.trim().chars().take(200).collect();
                if text.is_empty() {
                    return;
                }
                if let Some(w) = self.watchers.get(&cid) {
                    let msg = ServerMsg::Chat { from: w.name.clone(), text };
                    for w in self.watchers.values() {
                        let _ = w.out.send(msg.clone());
                    }
                }
            }
        }
    }

    fn sit(&mut self, cid: u64, seat: usize, buy_in: Option<u64>) -> Result<(), String> {
        let name = self.watchers.get(&cid).ok_or("Join the table first")?.name.clone();
        if self.seat_of(cid).is_some() {
            return Err("You are already seated".into());
        }
        if seat >= self.n() || self.seats[seat].is_some() {
            return Err("This seat is taken".into());
        }
        let buy = buy_in.unwrap_or(self.cfg.min_buy);
        if buy < self.cfg.min_buy || buy > self.cfg.max_buy {
            return Err(format!(
                "Buy-in must be between {} and {}",
                self.cfg.min_buy, self.cfg.max_buy
            ));
        }
        if !self.hub.wallets.take(&name, buy) {
            return Err("Insufficient balance".into());
        }
        self.seats[seat] = Some(Seat::new(cid, name.clone(), buy));
        self.push_log(format!("{} sits down with {}", name, buy));
        self.send_balance(cid, &name);
        self.maybe_schedule_start();
        Ok(())
    }

    fn eligible_count(&self) -> usize {
        self.seats
            .iter()
            .flatten()
            .filter(|s| s.stack > 0 && !s.leaving)
            .count()
    }

    fn maybe_schedule_start(&mut self) {
        if self.phase == Phase::Waiting && self.timer == Timer::None && self.eligible_count() >= 2 {
            self.set_timer(Timer::NextHand, START_MS);
        }
    }

    fn cash_out(&mut self, i: usize) {
        if let Some(s) = self.seats[i].take() {
            if self.hand_running() {
                self.dead += s.committed;
            }
            self.hub.wallets.give(&s.name, s.stack);
            self.send_balance(s.cid, &s.name);
            self.push_log(format!("{} leaves the table", s.name));
        }
    }

    fn remove_player(&mut self, cid: u64) {
        let Some(i) = self.seat_of(cid) else { return };
        if self.hand_running() && self.seat(i).in_hand {
            self.apply_fold(i);
            if self.to_act == Some(i) {
                self.after_action(i);
            } else {
                let alive = self.alive();
                if alive.len() == 1 {
                    self.win_uncontested(alive[0]);
                }
            }
        }
        self.cash_out(i);
        if self.phase == Phase::Waiting && self.eligible_count() < 2 {
            self.clear_timer();
        }
    }

    fn on_timer(&mut self) {
        match self.timer {
            Timer::Action => {
                self.clear_timer();
                if let Some(i) = self.to_act {
                    let to_call = self.current_bet.saturating_sub(self.seat(i).bet);
                    if to_call == 0 {
                        self.seat_mut(i).last_action = Some("Check".into());
                    } else {
                        self.apply_fold(i);
                    }
                    let s = self.seat_mut(i);
                    s.timeouts += 1;
                    if s.timeouts >= MAX_TIMEOUTS {
                        s.leaving = true;
                    }
                    self.after_action(i);
                }
            }
            Timer::NextHand => {
                self.clear_timer();
                self.start_hand();
            }
            Timer::None => self.deadline = None,
        }
    }

    fn next_where(&self, from: usize, pred: impl Fn(&Seat) -> bool) -> Option<usize> {
        let n = self.n();
        (1..=n)
            .map(|k| (from + k) % n)
            .find(|&j| self.seats[j].as_ref().map(&pred).unwrap_or(false))
    }

    fn alive(&self) -> Vec<usize> {
        (0..self.n())
            .filter(|&i| self.seats[i].as_ref().map(|s| s.in_hand).unwrap_or(false))
            .collect()
    }

    fn actors(&self) -> Vec<usize> {
        (0..self.n())
            .filter(|&i| {
                self.seats[i]
                    .as_ref()
                    .map(|s| s.in_hand && !s.all_in)
                    .unwrap_or(false)
            })
            .collect()
    }

    fn put(&mut self, i: usize, amount: u64) -> u64 {
        let s = self.seat_mut(i);
        let a = amount.min(s.stack);
        s.stack -= a;
        s.bet += a;
        s.committed += a;
        if s.stack == 0 {
            s.all_in = true;
        }
        a
    }

    fn start_hand(&mut self) {
        for i in 0..self.n() {
            if let Some(s) = &self.seats[i] {
                if s.leaving || s.stack == 0 {
                    let name = s.name.clone();
                    let timed_out = s.timeouts >= MAX_TIMEOUTS;
                    self.cash_out(i);
                    if timed_out {
                        self.push_log(format!("{} was removed for inactivity", name));
                    }
                }
            }
        }
        for s in self.seats.iter_mut().flatten() {
            s.reset();
        }
        self.board.clear();
        self.winners.clear();
        self.pots_view.clear();
        self.dead = 0;
        self.to_act = None;
        let occupied: Vec<usize> = (0..self.n()).filter(|&i| self.seats[i].is_some()).collect();
        if occupied.len() < 2 {
            self.phase = Phase::Waiting;
            self.button = None;
            self.sb_seat = None;
            self.bb_seat = None;
            self.clear_timer();
            return;
        }
        self.hand_no += 1;
        self.deck = shuffled_decks(1);
        for &i in &occupied {
            self.seat_mut(i).in_hand = true;
        }
        let start = self.button.unwrap_or(self.n() - 1);
        let button = self.next_where(start, |s| s.in_hand).unwrap();
        let (sb, bb) = if occupied.len() == 2 {
            (button, self.next_where(button, |s| s.in_hand).unwrap())
        } else {
            let sb = self.next_where(button, |s| s.in_hand).unwrap();
            (sb, self.next_where(sb, |s| s.in_hand).unwrap())
        };
        self.button = Some(button);
        self.sb_seat = Some(sb);
        self.bb_seat = Some(bb);
        for _ in 0..2 {
            let mut j = sb;
            for _ in 0..occupied.len() {
                let c = self.deck.pop().unwrap();
                self.seat_mut(j).hole.push(c);
                j = self.next_where(j, |s| s.in_hand).unwrap();
            }
        }
        self.phase = Phase::Preflop;
        self.push_log(format!("— Hand #{} —", self.hand_no));
        let small = self.cfg.sb;
        let big = self.cfg.bb;
        self.put(sb, small);
        self.seat_mut(sb).last_action = Some(format!("Small blind {}", small));
        self.put(bb, big);
        self.seat_mut(bb).last_action = Some(format!("Big blind {}", big));
        self.current_bet = big;
        self.min_raise = big;
        if self.round_complete() {
            self.end_street();
        } else {
            self.set_next_actor(bb);
        }
    }

    fn round_complete(&self) -> bool {
        let actors = self.actors();
        if actors.is_empty() {
            return true;
        }
        if actors.len() == 1 && self.seat(actors[0]).bet >= self.current_bet {
            let others_all_in = self.alive().len() > 1;
            if others_all_in {
                return true;
            }
        }
        actors
            .iter()
            .all(|&i| self.seat(i).acted && self.seat(i).bet == self.current_bet)
    }

    fn set_next_actor(&mut self, from: usize) {
        let cb = self.current_bet;
        let next = self.next_where(from, |s| s.in_hand && !s.all_in && (!s.acted || s.bet < cb));
        match next {
            Some(j) => {
                self.to_act = Some(j);
                self.set_timer(Timer::Action, ACTION_MS);
            }
            None => self.end_street(),
        }
    }

    fn act(&mut self, cid: u64, kind: &str, amount: Option<u64>) -> Result<(), String> {
        let i = self.seat_of(cid).ok_or("You are not seated")?;
        if !self.hand_running() || self.to_act != Some(i) {
            return Err("It's not your turn".into());
        }
        let to_call = self.current_bet.saturating_sub(self.seat(i).bet);
        match kind {
            "fold" => self.apply_fold(i),
            "check" => {
                if to_call > 0 {
                    return Err("You can't check".into());
                }
                self.seat_mut(i).last_action = Some("Check".into());
            }
            "call" => {
                if to_call == 0 {
                    self.seat_mut(i).last_action = Some("Check".into());
                } else {
                    let a = self.put(i, to_call);
                    let label = if self.seat(i).all_in { "All-in".to_string() } else { format!("Call {}", a) };
                    self.seat_mut(i).last_action = Some(label);
                }
            }
            "raise" | "bet" => {
                let target = amount.ok_or("Missing amount")?;
                self.raise_to(i, target)?;
            }
            "allin" => {
                let target = self.seat(i).bet + self.seat(i).stack;
                if target <= self.current_bet {
                    let stack = self.seat(i).stack;
                    self.put(i, stack);
                    self.seat_mut(i).last_action = Some("All-in".into());
                } else {
                    self.raise_to(i, target)?;
                }
            }
            _ => return Err("Unknown action".into()),
        }
        let name = self.seat(i).name.clone();
        if let Some(a) = self.seat(i).last_action.clone() {
            self.push_log(format!("{}: {}", name, a));
        }
        self.seat_mut(i).timeouts = 0;
        self.after_action(i);
        Ok(())
    }

    fn raise_to(&mut self, i: usize, target: u64) -> Result<(), String> {
        let max = self.seat(i).bet + self.seat(i).stack;
        if target > max {
            return Err("Not enough chips".into());
        }
        if target <= self.current_bet {
            return Err("A raise must exceed the current bet".into());
        }
        let raise = target - self.current_bet;
        if raise < self.min_raise && target != max {
            return Err(format!("Minimum raise to {}", self.current_bet + self.min_raise));
        }
        let was_open = self.current_bet == 0;
        let add = target - self.seat(i).bet;
        self.put(i, add);
        if raise >= self.min_raise {
            self.min_raise = raise;
            for j in 0..self.n() {
                if j != i {
                    if let Some(s) = self.seats[j].as_mut() {
                        s.acted = false;
                    }
                }
            }
        }
        self.current_bet = target;
        let label = if self.seat(i).all_in {
            "All-in".to_string()
        } else if was_open {
            format!("Bet {}", target)
        } else {
            format!("Raise to {}", target)
        };
        self.seat_mut(i).last_action = Some(label);
        Ok(())
    }

    fn apply_fold(&mut self, i: usize) {
        let s = self.seat_mut(i);
        s.folded = true;
        s.in_hand = false;
        s.last_action = Some("Fold".into());
    }

    fn after_action(&mut self, i: usize) {
        if let Some(s) = self.seats[i].as_mut() {
            s.acted = true;
        }
        let alive = self.alive();
        if alive.len() == 1 {
            self.win_uncontested(alive[0]);
            return;
        }
        if alive.is_empty() {
            self.finish(UNCONTESTED_MS);
            return;
        }
        if self.round_complete() {
            self.end_street();
        } else {
            self.set_next_actor(i);
        }
    }

    fn deal_board(&mut self, count: usize) {
        self.deck.pop();
        for _ in 0..count {
            if let Some(c) = self.deck.pop() {
                self.board.push(c);
            }
        }
    }

    fn end_street(&mut self) {
        self.to_act = None;
        self.clear_timer();
        for s in self.seats.iter_mut().flatten() {
            s.bet = 0;
            s.acted = false;
            if s.in_hand && !s.all_in {
                s.last_action = None;
            }
        }
        self.current_bet = 0;
        self.min_raise = self.cfg.bb;
        match self.phase {
            Phase::Preflop => {
                self.deal_board(3);
                self.phase = Phase::Flop;
            }
            Phase::Flop => {
                self.deal_board(1);
                self.phase = Phase::Turn;
            }
            Phase::Turn => {
                self.deal_board(1);
                self.phase = Phase::River;
            }
            _ => {
                self.showdown();
                return;
            }
        }
        if self.actors().len() <= 1 {
            for i in self.alive() {
                self.seat_mut(i).revealed = true;
            }
            self.end_street();
        } else {
            let from = self.button.unwrap_or(0);
            self.set_next_actor(from);
        }
    }

    fn total_pot(&self) -> u64 {
        self.seats.iter().flatten().map(|s| s.committed).sum::<u64>() + self.dead
    }

    fn build_pots(&self) -> Vec<Pot> {
        let n = self.n();
        let mut contrib: Vec<u64> = (0..n)
            .map(|i| self.seats[i].as_ref().map(|s| s.committed).unwrap_or(0))
            .collect();
        let mut pots: Vec<Pot> = Vec::new();
        loop {
            let live: Vec<usize> = (0..n)
                .filter(|&i| contrib[i] > 0 && self.seats[i].as_ref().map(|s| s.in_hand).unwrap_or(false))
                .collect();
            if live.is_empty() {
                let rest: u64 = contrib.iter().sum();
                if rest > 0 {
                    if let Some(last) = pots.last_mut() {
                        last.amount += rest;
                    }
                }
                break;
            }
            let level = live.iter().map(|&i| contrib[i]).min().unwrap();
            let mut amount = 0;
            for c in contrib.iter_mut() {
                let t = (*c).min(level);
                amount += t;
                *c -= t;
            }
            pots.push(Pot { amount, eligible: live });
        }
        if let Some(first) = pots.first_mut() {
            first.amount += self.dead;
        }
        pots
    }

    fn win_uncontested(&mut self, w: usize) {
        let total = self.total_pot();
        let s = self.seat_mut(w);
        s.stack += total;
        let name = s.name.clone();
        self.winners = vec![PokerWinner { seat: w, name: name.clone(), amount: total, hand_name: None, best: vec![] }];
        self.pots_view = vec![total];
        self.push_log(format!("{} wins {} uncontested", name, total));
        self.finish(UNCONTESTED_MS);
    }

    fn showdown(&mut self) {
        let alive = self.alive();
        let mut values: HashMap<usize, HandValue> = HashMap::new();
        for &i in &alive {
            let mut cards = self.seat(i).hole.clone();
            cards.extend(self.board.iter().copied());
            let v = evaluate(&cards);
            let s = self.seat_mut(i);
            s.revealed = true;
            s.hand_name = Some(describe(&v));
            values.insert(i, v);
        }
        let pots = self.build_pots();
        let n = self.n();
        let button = self.button.unwrap_or(0);
        let mut won = vec![0u64; n];
        let mut best_of: HashMap<usize, Vec<String>> = HashMap::new();
        for pot in &pots {
            let best = pot.eligible.iter().filter_map(|i| values.get(i)).max().cloned();
            let Some(best) = best else { continue };
            let mut ws: Vec<usize> = pot
                .eligible
                .iter()
                .copied()
                .filter(|i| values.get(i).map(|v| v.cmp(&best) == Ordering::Equal).unwrap_or(false))
                .collect();
            ws.sort_by_key(|&j| (j + n - button - 1) % n);
            let share = pot.amount / ws.len() as u64;
            let rem = pot.amount % ws.len() as u64;
            for (k, &j) in ws.iter().enumerate() {
                won[j] += share + if k == 0 { rem } else { 0 };
                best_of.insert(j, codes(&values[&j].best));
            }
        }
        self.winners.clear();
        for j in 0..n {
            if won[j] > 0 {
                let s = self.seat_mut(j);
                s.stack += won[j];
                let name = s.name.clone();
                let hand_name = s.hand_name.clone();
                self.push_log(format!(
                    "{} wins {} with {}",
                    name,
                    won[j],
                    hand_name.clone().unwrap_or_default()
                ));
                self.winners.push(PokerWinner {
                    seat: j,
                    name,
                    amount: won[j],
                    hand_name,
                    best: best_of.remove(&j).unwrap_or_default(),
                });
            }
        }
        self.pots_view = pots.iter().map(|p| p.amount).collect();
        self.finish(SHOWDOWN_MS);
    }

    fn finish(&mut self, ms: u64) {
        self.phase = Phase::Showdown;
        self.to_act = None;
        for s in self.seats.iter_mut().flatten() {
            s.bet = 0;
        }
        self.set_timer(Timer::NextHand, ms);
    }

    fn view_for(&self, cid: u64, now: Instant) -> PokerView {
        let you = self.seat_of(cid);
        let seats = self
            .seats
            .iter()
            .map(|s| {
                s.as_ref().map(|s| PokerSeatView {
                    name: s.name.clone(),
                    stack: s.stack,
                    bet: s.bet,
                    in_hand: s.in_hand,
                    folded: s.folded,
                    all_in: s.all_in,
                    has_cards: s.in_hand && !s.hole.is_empty(),
                    cards: if s.revealed && s.in_hand { Some(codes(&s.hole)) } else { None },
                    hand_name: if s.revealed && s.in_hand { s.hand_name.clone() } else { None },
                    last_action: s.last_action.clone(),
                    leaving: s.leaving,
                })
            })
            .collect();
        let bets: u64 = self.seats.iter().flatten().map(|s| s.bet).sum();
        let pot = self.total_pot() - bets;
        let (mut to_call, mut min_raise_to, mut max_raise_to) = (0, 0, 0);
        let (mut my_cards, mut my_hand, mut my_category) = (Vec::new(), None, None);
        if let Some(i) = you {
            let s = self.seat(i);
            to_call = self.current_bet.saturating_sub(s.bet).min(s.stack);
            max_raise_to = s.bet + s.stack;
            min_raise_to = if self.current_bet == 0 {
                self.cfg.bb
            } else {
                self.current_bet + self.min_raise
            }
            .min(max_raise_to);
            if !s.hole.is_empty() {
                my_cards = codes(&s.hole);
                let mut all = s.hole.clone();
                all.extend(self.board.iter().copied());
                let v = evaluate(&all);
                my_hand = Some(describe(&v));
                my_category = Some(display_category(&v));
            }
        }
        let timer_ms = match (self.deadline, self.timer) {
            (Some(d), Timer::Action) | (Some(d), Timer::NextHand) => {
                Some(d.saturating_duration_since(now).as_millis() as u64)
            }
            _ => None,
        };
        let timer_total_ms = match self.timer {
            Timer::Action => ACTION_MS,
            Timer::NextHand if self.phase == Phase::Waiting => START_MS,
            Timer::NextHand => SHOWDOWN_MS,
            Timer::None => 0,
        };
        PokerView {
            table: self.summary(),
            phase: self.phase.name().to_string(),
            hand_no: self.hand_no,
            board: codes(&self.board),
            pot,
            pots: if self.phase == Phase::Showdown { self.pots_view.clone() } else { vec![pot] },
            current_bet: self.current_bet,
            min_raise_to,
            max_raise_to,
            to_call,
            button: self.button,
            sb_seat: self.sb_seat,
            bb_seat: self.bb_seat,
            to_act: self.to_act,
            timer_ms,
            timer_total_ms,
            seats,
            you,
            my_cards,
            my_hand,
            my_category,
            winners: self.winners.clone(),
            log: self.log.iter().cloned().collect(),
        }
    }

    fn broadcast(&mut self) {
        let now = Instant::now();
        let mut dead = Vec::new();
        for (&cid, w) in &self.watchers {
            let v = self.view_for(cid, now);
            if w.out.send(ServerMsg::Poker { state: Box::new(v) }).is_err() {
                dead.push(cid);
            }
        }
        for cid in dead {
            self.watchers.remove(&cid);
        }
    }
}
