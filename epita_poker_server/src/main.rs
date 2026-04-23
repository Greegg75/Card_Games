mod engine;
mod state;
mod network;

use axum::{routing::get, Router};
use network::handlers::ws_handler;
use state::lobby::init_state;
use tokio::net::TcpListener;

#[tokio::main]
async fn main() {
    // Initialise les logs pour le terminal
    tracing_subscriber::fmt::init();

    // Initialisation de l'état global partagé
    let app_state = init_state();

    // Configuration des routes Axum
    let app = Router::new()
        // Route dynamique: on se connecte via ws://localhost:3000/ws/nom_de_la_table
        .route("/ws/:table_id", get(ws_handler))
        .with_state(app_state);

    let addr = "0.0.0.0:3000";
    let listener = TcpListener::bind(addr).await.unwrap();

    tracing::info!("Serveur de Poker Rust lancé sur {}", addr);

    // Lancement du serveur en bloquant le thread principal.
    // L'exécution s'arrêtera ici et gérera les connexions asynchrones.
    // Plus besoin de tokio::spawn ni de boucle sleep !
    axum::serve(listener, app).await.unwrap();
}