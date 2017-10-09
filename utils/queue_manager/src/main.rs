/*
 * Cardinal Queue Manager
 * Matt Bilker <me@mbilker.us>
 */

#![allow(non_snake_case)]

extern crate ansi_term;
#[macro_use] extern crate lazy_static;
extern crate redis;
extern crate regex;
extern crate serde_json;
#[macro_use] extern crate serde_derive;

use ansi_term::Colour::{Blue, Green, Red, Yellow};
use regex::Regex;
use std::fmt;
use std::io::{self, Write};

lazy_static! {
	static ref RE: Regex = Regex::new(r"^cardinal\.(\d+).music_queue$").unwrap();
}

macro_rules! debug {
	($($arg:tt)+) => {
		println!(" {} {}", Yellow.paint("[^]"), format!($($arg)+));
	}
}

macro_rules! input {
	($($arg:tt)+) => {
		print!(" {} {}", Blue.paint("[*]"), format!($($arg)+));
	}
}

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

#[derive(Serialize, Deserialize, Debug)]
struct PlaylistEntry {
  ownerId: String,
  guildId: String,
  url: String,
  title: String,
  id: String,
  duration: i32,
  encoding: String,
}

impl fmt::Display for PlaylistEntry {
  fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
    try!(write!(f, "PlaylistEntry {{\n"));
    try!(write!(f, "  ownerId: {:?}\n", self.ownerId));
    try!(write!(f, "  guildId: {:?}\n", self.guildId));
    try!(write!(f, "  url: {:?}\n", self.url));
    try!(write!(f, "  title: {:?}\n", self.title));
    try!(write!(f, "  id: {:?}\n", self.id));
    try!(write!(f, "  duration: {:?}\n", self.duration));
    try!(write!(f, "  encoding: {:?}\n", self.encoding));
    try!(write!(f, "}}"));
    Ok(())
  }
}

fn redis_connect(host: &str, port: i32) -> Result<redis::Connection, redis::RedisError> {
  let redis_client = try!(redis::Client::open(format!("redis://{}:{}", host, port).as_str()));
  let redis_conn = try!(redis_client.get_connection());
  Ok(redis_conn)
}

fn print_queue(connection: &redis::Connection, selection: String) {
  let len: i32 = redis::cmd("LLEN").arg(&selection).query(connection).unwrap();
  debug!("List length: {}", len);

  let list: Vec<String> = redis::cmd("LRANGE").arg(&selection).arg(0).arg(len).query(connection).unwrap();
  for (i, entry) in list.iter().enumerate() {
    let p_entry: PlaylistEntry = serde_json::from_str(&entry).unwrap();
    info!("{} - {}", i, p_entry);
  }
}

fn select_queue(queues: Vec<(String, String)>) -> Option<String> {
  if queues.len() == 0 {
    error!("No music queues found");

    return None;
  }

  info!("Queues stored in Redis:");
  for (i, &(_, ref id)) in queues.iter().enumerate() {
    info!(" {}: {}", i + 1, id);
  }

  // Print out prefix message and flush stdout to ensure the message is shown
  // before reading from standard in
  println!();
  input!("Select queue to modify: ");
  io::stdout().flush().ok().expect("failed to flush guild selection prefix message");

  // Read the user input into string buffer and get the length of the user
  // input
  let mut buffer = String::new();
  let mut len = io::stdin().read_line(&mut buffer).ok().expect("failed to read guild selection");

  // Cut out the new line character
  let text = &buffer[0..len-1];
  len -= 1;

  let queues_len = queues.len() as i32;
  if let Ok(selection) = text.trim().parse::<i32>() {
    info!("read: {} (len: {}) => parsed: {:?}", text, len, selection);

    if selection < 1 {
      error!("Invalid selection! ({} < 1)", selection);
      None
    } else if selection > queues_len {
      error!("Invalid selection! ({} > {})", selection, queues.len());
      None
    } else {
      let index = selection - 1;
      let &(ref key, _) = queues.get(index as usize).unwrap();
      Some(key.clone())
    }
  } else {
    None
  }
}

fn main() {
  info!("Cardinal Queue Manager");
  info!("By Matt Bilker <me@mbilker.us>");
  println!();

  let redis_host = "localhost";
  let redis_port = 6379;
  let redis_conn = match redis_connect(redis_host, redis_port) {
    Ok(x) => x,
    Err(err) => {
      error!("Error connecting to Redis: {:?}", err);
      return;
    }
  };

  let iter: redis::Iter<String> = redis::cmd("SCAN").cursor_arg(0).iter(&redis_conn).unwrap();
  let filtered = iter.filter(|x| RE.is_match(&x));
  let id_matches: Vec<(String, String)> = filtered.map(|x| (x.clone(), RE.captures(&x).unwrap().get(1).unwrap().as_str().to_owned())).collect();

  for (i, &(ref full_key, ref id)) in id_matches.iter().enumerate() {
    debug!("{} => Regex match: {:?} => {:?}", i, full_key, id);

    // TODO: Have Cardinal store server information in some database
  }

  if let Some(selection) = select_queue(id_matches) {
    debug!("selection: {:?}", selection);

    print_queue(&redis_conn, selection);
  }
}
