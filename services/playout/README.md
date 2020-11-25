# Clowdr: Playout Service

Service that provides playout functionality. Listens for data and API calls from Hasura/actions layer. Orchestrates AWS MediaLive.

## Pre-requisites

1. [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)

## Setting Up

1. Copy the `services/playout/.env.example` to `services/playout/.env`
1. Configure your `.env` according to the [Playout Service
   Configuration](#playout-service-configuration) table below

## Playout Service Configuration

| Key | Value |
| --- | ----- |

