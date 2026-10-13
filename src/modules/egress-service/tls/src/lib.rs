//! A bounded synchronous TLS engine. JavaScript owns socket IO and cancellation.
use std::{cell::RefCell, io::{Read, Write}, sync::Arc};
use rustls::{ClientConfig, ClientConnection, RootCertStore, pki_types::{ServerName, UnixTime}, time_provider::TimeProvider};

use wasm_bindgen::prelude::*;
#[derive(Debug)]
struct Clock;
impl TimeProvider for Clock {
    fn current_time(&self) -> Option<UnixTime> {
        let ms = js_sys::Date::now();
        if !ms.is_finite() || ms < 0.0 || ms > 8_640_000_000_000_000.0 { return None; }
        Some(UnixTime::since_unix_epoch(std::time::Duration::from_secs((ms / 1000.0) as u64)))
    }
}
const CAP: usize = 65536;
thread_local! {
    static BUFFER: RefCell<Box<[u8; CAP]>> = RefCell::new(Box::new([0; CAP]));
    static CLOSED: RefCell<bool> = const { RefCell::new(false) };
    static SESSION: RefCell<Option<ClientConnection>> = const { RefCell::new(None) };
    #[cfg(feature = "test-roots")]
    static EXTRA: RefCell<Vec<Vec<u8>>> = const { RefCell::new(Vec::new()) };
}
#[wasm_bindgen]
pub extern "C" fn buffer() -> *mut u8 { BUFFER.with(|b| b.borrow_mut().as_mut_ptr()) }
#[cfg(feature = "test-roots")]
#[wasm_bindgen]
pub extern "C" fn test_root(len: usize) -> i32 {
    if len > CAP { return -1; }
    BUFFER.with(|b| EXTRA.with(|e| e.borrow_mut().push(b.borrow()[..len].to_vec()))); 0
}
#[wasm_bindgen]
pub extern "C" fn start(len: usize) -> i32 {
    if len > 253 { return -1; }
    let result = BUFFER.with(|b| {
        let b = b.borrow();
        let name = ServerName::try_from(std::str::from_utf8(&b[..len]).map_err(|_| ())?.to_owned()).map_err(|_| ())?;
        let mut roots = RootCertStore::empty();
        roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
        #[cfg(feature = "test-roots")]
        EXTRA.with(|e| { for cert in e.borrow().iter() { roots.add(rustls::pki_types::CertificateDer::from(cert.clone())).unwrap(); } });
        let mut config = ClientConfig::builder_with_details(Arc::new(rustls::crypto::ring::default_provider()), Arc::new(Clock))
            .with_safe_default_protocol_versions().map_err(|_| ())?.with_root_certificates(roots).with_no_client_auth();
        config.alpn_protocols = vec![b"http/1.1".to_vec()];
        let mut client = ClientConnection::new(Arc::new(config), name).map_err(|_| ())?;
        client.set_buffer_limit(Some(CAP));
        SESSION.with(|s| *s.borrow_mut() = Some(client));
        Ok::<(), ()>(())
    });
    if result.is_ok() { 0 } else { -1 }
}
fn session(f: impl FnOnce(&mut ClientConnection, &mut [u8]) -> Result<usize, ()>) -> i32 {
    SESSION.with(|s| BUFFER.with(|b| {
        let mut s = s.borrow_mut(); let mut b = b.borrow_mut();
        s.as_mut().and_then(|c| f(c, &mut b[..]).ok()).map(|n| n as i32).unwrap_or(-1)
    }))
}
#[wasm_bindgen]
pub extern "C" fn receive(len: usize) -> i32 {
    if len > CAP { return -1; }
    session(|c,b| { let n = c.read_tls(&mut &b[..len]).map_err(|_| ())?; let state = c.process_new_packets().map_err(|_| ())?; CLOSED.with(|v| *v.borrow_mut() = state.peer_has_closed()); Ok(n) })
}
#[wasm_bindgen]
pub extern "C" fn send(len: usize) -> i32 {
    if len > 16384 { return -1; }
    session(|c,b| { if c.is_handshaking() { return Err(()); } c.writer().write(&b[..len]).map_err(|_| ()) })
}
#[wasm_bindgen]
pub extern "C" fn drain_tls() -> i32 { session(|c,b| c.write_tls(&mut &mut b[..]).map_err(|_| ())) }
#[wasm_bindgen]
pub extern "C" fn drain_plain() -> i32 { session(|c,b| match c.reader().read(b) { Ok(n) => Ok(n), Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => Ok(0), Err(_) => Err(()) }) }
#[wasm_bindgen]
pub extern "C" fn handshaking() -> i32 { session(|c,_| Ok(usize::from(c.is_handshaking()))) }

#[wasm_bindgen]
pub extern "C" fn peer_closed() -> bool { CLOSED.with(|v| *v.borrow()) }
