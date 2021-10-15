import { StringPublicKey } from "@oyster/common";

export interface Auction {
  name: string;
  auctionerName: string;
  auctionerLink: string;
  highestBid: number;
  solAmt: number;
  link: string;
  image: string;
}

export interface Artist {
  address?: string;
  description?: string;
  name?: string;
  username?: string;
  link?: string;
  banner?: string;
  image: string;
  itemsAvailable?: number;
  itemsSold?: number;
  about?: string;
  verified?: boolean;

  share?: number;
}

export enum ArtType {
  Master,
  Print,
  NFT,
}
export interface Art {
  uri: string | undefined;
  mint: string | undefined;
  link: string;
  title: string;
  artist: string;
  seller_fee_basis_points?: number;
  creators?: Artist[];
  type: ArtType;
  edition?: number;
  supply?: number;
  maxSupply?: number;
  subscription?: StringPublicKey;
}

export interface Presale {
  targetPricePerShare?: number;
  pricePerShare?: number;
  marketCap?: number;
}
