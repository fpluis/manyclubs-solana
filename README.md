# ManyClubs

[My entry to the Solana IGNITION Hackathon](https://devpost.com/software/keyther)

**NOTE**: This project is only a demo meant to be used as a starting point for a blockchain project. Some parts such as NFT-based auth using AWS are reusable, but the Metaplex code is many commits behind the master.

ManyClubs is a platform where creators can mint NFTs that grant private access to clubs, and optionally tie that access to a subscription. Creators can post any type of content (text, video or other media) to those clubs and specify one of three possible access levels:

- Public: Everyone can see the post and its contents.
- Community: Only users who own a key to that club can see the post.
- Subscriber-only: Only users who own both a key and a paid subscription to that club can see the post.

ManyClubs is an extension of Metaplex, which is both a protocol to mint and auction NFTs and a web2 storefront for them. Therefore, it uses Metaplex's marketplace, where users can buy and sell club keys. The key differences with Metaplex are:

1. Token metadata can have a subscription associated.
2. The focus is on creator content, not so much on the NFTs behind it.
3. The content is hosted on a server that authenticates users through their wallets.

Users do not need to create an account to get started on ManyClubs, they only need a Phantom wallet. When they connect their wallet, ManyClubs will ask them to sign a message with their wallet to verify their identity. After that, and until they log out, ManyClubs will keep their session fresh and use their wallet credentials to access content without a password.

The reason to have private servers is controlling access to content that creators want to keep private, which is a valuable service. However, having subscriptions, limited edition tokens and a marketplace opens up a world of possibilities for both creators and fans:

- Scarcity: Creators can specify a limited number of seats for their club. Fans who buy into that club are both gaining immediate access to content and making an investment on a scarce asset.
- Investing on a service: A creator can sell a limited-edition NFT that gives the buyer the right to a physical signed copy of a book, to airtime on a podcast, to a custom picture or video, and anything else a creator is willing to sell. The sky is the limit.
- Subscriptions have granular time periods: They can be used to access content for a few minutes or hours, say an online stream, as well as for months or years.
- Users can prove their support using their subscription: A subscription can be renewed any number of times before it ends, extending its remaining time. This feature, loosely inspired by the proof-of-stake algorithm, lets users prove their commitment to a club by buying multiple consecutive subscription periods. Clubs can then choose to reward users based on their investment.
- Other applications can use the club keys to provide services: For example, a Discord bot could grant users specific roles on a server if they prove they own a certain token, similarly to what the Grapes Network already does with other tokens.

## Architecture

There are three main software components in ManyClubs:

- The Solana programs: This includes the Metaplex programs, which are available at their github repository and the Subscription program I developed for this hackathon.
- The Store: As an extension of the Metaplex Store frontend, users can create clubs and posts, see other users's clubs and posts, and trade keys on the marketplace.
- The Content servers: These servers provide the infrastructure necessary to both host user content and control access to it requiring the user to authenticate with a wallet that holds the keys necessary to access a community.

## Advantages compared to web2 alternatives
There are already other well-established subscription-based creator platforms, so a natural question would be: is this really a viable alternative? I have several reasons to believe ManyClubs can become a serious competitor to traditional creator platforms:

### Fees are tiny thanks to Solana
A web2 creator platform has at least these fees:

- Platform fee.
- Payment processing fees + the taxes on these payments.
- Payout fees (moving the payments to the creator's bank account).
- Currency conversion fees.

These fees add up to 10%, 15% or more of what the creator earns. In ManyClubs, there will still a platform fee (ideally 2.5%, the same as opensea.io) to pay for the service provided to users and a currency conversion fees for users who don't already own Solana.

Where creators really save money is in payment processing and payout fees, since Solana's costs are flat instead of a percentage of the creator's income.

### Fans have investments, not expenses

Buyers are incentivized to buy access to clubs not just because they want to see the creator's content, but also because they are making an investment that might pay off if the creator grows in popularity. At the same time, creators keep a percentage of each resale through ManyClubs, so they are incentivized to keep making good content that attracts sales.

The potential problem for a creator would be creating a club where the access keys are highly valued but everyone is holding them. Subscriptions solve this problem by making fans pay to access content, giving the creator a steady source of income. At the same time, subscriptions allow creators to model most if not all payments models they can find in a web2 alternative.

### Resilience against hostile agents

ManyClubs servers store creator content because their purpose is to control user access. The problem is that it makes them a centralized point of failure vulnerable to external attacks or regulation. But, even if the servers where the content is hosted are shut down, users retain proof of their access to a club. They can use that token in any other application that recognizes these tokens.

Because all payments are made using a blockchain, there are no payment processor who can dictate what kind of content or creator is allowed on the platform. This is a major problem for web2 platforms that host user content and rely on payment processors.

## Installing

Clone the repo, and run `yarn start` to deploy.

```bash
$ git clone https://github.com/metaplex-foundation/metaplex.git
$ cd metaplex
$ cd js
$ yarn install
$ yarn bootstrap
$ yarn start
```

This will start up a local dev server. To deploy the infrastructure, run the following commands from the project's root:
```bash
$ cd js
$ rollup -c
$ terraform init
$ terraform apply
```

The client will ask for a few variables needed for the deployment of infrastructure. See main.tf for the vars required.

## Metaplex

This repo was originally cloned from [Metaplex](https://github.com/metaplex-foundation/metaplex) and then extended with custom functionality.
