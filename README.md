# Permissionless.Money Website

## Contents\n\n- IPFS CID: (updated on deploy)

- HTML website
- Smart-Contract Web Server
<!-- - IPFS/FILECOIN/JACKAL CLI for deploying to ipfs -->
- Docker image for containerized deployment
- Akash Network deployment configuration
- create wallet via passkey
- terp-account-billboards: use the namespace-record storage desgin to manage IPFS links to website (blend cw-server logic into contracts)

## Storage Uploader CLI

- use existing jackal one for worklfow
- add support for filebase/ storacha/ the one vb described

## Docker Deployment

### Building the Docker Image

The website uses an extremely lightweight nginx:alpine base image (approximately 40MB).

1. **Build the Docker image:**

   ```bash
    docker buildx build --platform linux/amd64,linux/arm64 -t permissionlessweb/permissionless-money:v0.0.2 --push .
   # docker run -d -p 8080:80 permissionlessweb/permissionless-money:latest
   ```

### Pushing to Docker Hub

1. **Login to Docker Hub:**

   ```bash
   docker login
   # Push versioned tag
   docker push permissionlessweb/permissionless-money:v1.0.0

   # Push latest tag
   docker push permissionlessweb/permissionless-money:latest
   ```

### Deploy via Akash Console

## Resources

- [Akash Network Documentation](https://akash.network/docs/)
- [Akash Discord Community](https://discord.akash.network)
- [awesome-akash Templates](https://github.com/akash-network/awesome-akash)
