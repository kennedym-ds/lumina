use rand::Rng;
use std::net::TcpListener;

/// Find a free TCP port on 127.0.0.1.
/// Tries the preferred port first, then up to `retries` random ports.
pub fn find_free_port(preferred: u16, retries: u32) -> Option<u16> {
    // Try preferred port first
    if TcpListener::bind(format!("127.0.0.1:{}", preferred)).is_ok() {
        return Some(preferred);
    }

    // Try random ports
    let mut rng = rand::thread_rng();
    for _ in 0..retries {
        let port: u16 = rng.gen_range(10000..60000);
        if TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok() {
            return Some(port);
        }
    }

    None
}

/// Generate a random bearer token for this session.
pub fn generate_token() -> String {
    use rand::distributions::Alphanumeric;
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(48)
        .map(char::from)
        .collect()
}