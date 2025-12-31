# n8n Production Setup

Production-ready Docker Compose setup for n8n workflow automation platform with PostgreSQL database.

## Features

- ✅ Production-optimized configuration
- ✅ Health checks for all services
- ✅ Resource limits and reservations
- ✅ Security hardening (non-root, no-new-privileges)
- ✅ Logging with rotation
- ✅ Isolated network
- ✅ Environment variable management
- ✅ Data persistence

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 4GB RAM available
- 10GB+ free disk space

## Quick Start

1. **Clone and navigate to the directory:**
   ```bash
   cd /path/to/n8n
   ```

2. **Generate encryption key:**
   ```bash
   openssl rand -base64 32
   ```

3. **Update `.env` file:**
   - Add the generated encryption key to `N8N_ENCRYPTION_KEY`
   - Review and adjust other settings as needed
   - **IMPORTANT:** Change all default passwords in production!

4. **Start the services:**
   ```bash
   docker-compose up -d --build
   ```

5. **Check service status:**
   ```bash
   docker-compose ps
   docker-compose logs -f n8n
   ```

6. **Access n8n:**
   - Open browser: `http://localhost:5678`
   - Complete the initial setup wizard

## Configuration

### Environment Variables

All configuration is managed through the `.env` file. Key variables:

- **Database:** `POSTGRES_*` variables
- **n8n Settings:** `N8N_*` variables
- **Resources:** `*_CPU_LIMIT`, `*_MEMORY_LIMIT` variables
- **Security:** `N8N_ENCRYPTION_KEY` (REQUIRED in production)

### Resource Limits

Default resource limits:
- **PostgreSQL:** 2 CPU, 2GB RAM (limit) / 0.5 CPU, 512MB RAM (reservation)
- **n8n:** 2 CPU, 2GB RAM (limit) / 0.5 CPU, 512MB RAM (reservation)

Adjust in `.env` based on your workload.

### Security Best Practices

1. **Change default passwords** in `.env`
2. **Set strong encryption key** (`N8N_ENCRYPTION_KEY`)
3. **Use HTTPS** in production (set `N8N_PROTOCOL=https`)
4. **Restrict network access** (use reverse proxy like nginx)
5. **Regular backups** of volumes
6. **Keep images updated** regularly

## Maintenance

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f n8n
docker-compose logs -f postgres
```

### Backup Database
```bash
docker-compose exec postgres pg_dump -U variphi n8n_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database
```bash
docker-compose exec -T postgres psql -U variphi n8n_db < backup_file.sql
```

### Update Services
```bash
docker-compose pull
docker-compose up -d --build
```

### Stop Services
```bash
docker-compose down
```

### Remove All Data (⚠️ Destructive)
```bash
docker-compose down -v
```

## Monitoring

### Health Checks
Services include health checks that can be monitored:
```bash
docker-compose ps
```

### Metrics
n8n metrics are enabled by default. Access at:
- Metrics endpoint: `http://localhost:5678/metrics` (if enabled)

## Troubleshooting

### Service won't start
1. Check logs: `docker-compose logs [service-name]`
2. Verify `.env` file has all required variables
3. Check disk space: `df -h`
4. Verify ports are not in use: `netstat -tulpn | grep 5678`

### Database connection errors
1. Ensure PostgreSQL is healthy: `docker-compose ps postgres`
2. Check database credentials in `.env`
3. Verify network connectivity: `docker-compose exec n8n ping postgres`

### Performance issues
1. Increase resource limits in `.env`
2. Check system resources: `docker stats`
3. Review n8n execution logs
4. Consider adding Redis for queue management

## Production Deployment

### Recommended Setup

1. **Use a reverse proxy** (nginx/traefik) for HTTPS
2. **Set up automated backups** (cron job + pg_dump)
3. **Enable monitoring** (Prometheus/Grafana)
4. **Use secrets management** (Docker secrets, Vault, etc.)
5. **Implement log aggregation** (ELK, Loki, etc.)
6. **Set up alerts** for service failures

### Example nginx configuration:
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:5678;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## License

This setup is for deploying n8n. n8n itself is licensed under the [Sustainable Use License](https://github.com/n8n-io/n8n/blob/master/LICENSE.md).



1. Generate encryption key:
   ./generate-key.sh
Then add it to your .env file.

2. Review and update .env:
    Change default passwords
    Set N8N_ENCRYPTION_KEY
    Adjust resource limits if needed

3. Start services:
   docker-compose up -d --build

4. Monitor:
   docker-compose ps  # Check health status
   docker-compose logs -f  # View logs




<!-- echo "# CI trigger $(date)" >> README.md -->
