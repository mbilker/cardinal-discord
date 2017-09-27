/*
 * Cardinal Queue Manager
 * Matt Bilker <me@mbilker.us>
 */

extern crate ansi_term;
extern crate redis;
extern crate serde_json;

use ansi_term::Colour::{Green, Red};

macro_rules! info {
	($($arg:tt)+) => {
		println!(" {} {}", Green.paint("[*]"), format!($($arg)+));
	}
}

macro_rules! error {
	($($arg:tt)+) => {
		println!(" {} {}", Red.paint("[-]"), format!($($arg)+));
	}
}

fn main() {
  info!("Cardinal Queue Manager");
  info!("By Matt Bilker <me@mbilker.us>");
  println!();

  //info!("macro usage");
  //error!("test error");

  let redis_host = "localhost";
  let redis_port = 6379;
  let redis_client = redis::Client::open(format!("redis://{}:{}", redis_host, redis_port).as_str()).unwrap();
  let redis_conn = redis_client.get_connection().unwrap();

  let iter: redis::Iter<String> = redis::cmd("SCAN").cursor_arg(0).iter(&redis_conn).unwrap();
  for item in iter {
    info!("redis item: {}", item);
  }
}
