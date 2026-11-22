mod accounts;
mod blackjack;
mod cards;
mod conn;
mod eval;
mod hub;
mod poker;
mod protocol;

use axum::routing::get;
use axum::Router;
use std::net::{SocketAddr, UdpSocket};
use std::path::{Path, PathBuf};
use tower_http::services::{ServeDir, ServeFile};

fn lan_ip() -> Option<String> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    Some(socket.local_addr().ok()?.ip().to_string())
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_target(false).init();

    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(3000);
    let static_dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "../client/dist".into());
    let data_dir = std::env::var("DATA_DIR").unwrap_or_else(|_| "data".into());

    let hub = hub::Hub::new(PathBuf::from(data_dir));
    hub.spawn_tables();

    let index = Path::new(&static_dir).join("index.html");
    if !index.exists() {
        tracing::warn!(
            "Frontend introuvable dans {} — lancez `npm run build` dans client/ (ou utilisez `npm run dev`)",
            static_dir
        );
    }
    let files = ServeDir::new(&static_dir).not_found_service(ServeFile::new(index));

    let app = Router::new()
        .route("/ws", get(conn::ws_handler))
        .with_state(hub)
        .fallback_service(files);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await.expect("Port déjà utilisé");

    println!();
    println!("  ♠ ♥  Aurum Club — serveur prêt  ♦ ♣");
    println!("  Sur cette machine : http://localhost:{}", port);
    if let Some(ip) = lan_ip() {
        println!("  Sur le réseau     : http://{}:{}", ip, port);
    }
    println!();

    axum::serve(listener, app).await.unwrap();
}
