#![allow(warnings)]

mod errors;
mod utils;

pub mod entrypoint;
pub mod instruction;
pub mod processor;

/// Prefix used in PDA derivations to avoid collisions with other programs.
pub const PREFIX: &str = "auction";

pub const EXTENDED: &str = "extended";
solana_program::declare_id!("E6WaQgpxTKEguevLkAJkogfhBsgfnsGyD15Yk4THxreW");
