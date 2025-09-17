# TMS Kernel + Plugin SDK

A modern, extensible Transportation Management System with plugin architecture.

## 🚀 Features

- **Strong Contracts**: All interactions validated through JSON schemas and Zod
- **Plugin Ecosystem**: Extensible through hooks, events, APIs, and UI slots
- **Party Graph**: Multi-tier broker→carrier→driver relationships
- **Stage Pipeline**: Dependencies-based shipment lifecycle management
- **Settlement Chain**: Complex multi-link payment flows
- **Cascade Tenders**: Sequential and parallel tender modes

## 📁 Project Structure

```
TMS/
├── apps/
│   ├── api/          # NestJS API server
│   └── web/          # Next.js web application
├── packages/
│   ├── contracts/    # JSON schemas, types, events
│   └── plugin-sdk/   # Plugin development SDK
└── plugins/
    └── mod-pallet-return/  # Sample plugin
```

## 🛠 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 14+

### Installation

```bash
# Clone and install dependencies
git clone <repo-url>
cd TMS
pnpm install

# Set up environment
cp apps/api/.env.example apps/api/.env
# Edit .env with your database connection

# Set up database
cd apps/api
pnpm db:migrate
pnpm db:seed

# Build packages
pnpm build

# Start development servers
pnpm dev
```

This will start:
- API server on http://localhost:3000
- Web app on http://localhost:3001

## 📖 Core Concepts

### 1. Party Graph

Multi-tier relationships between business entities:

```
Shipper → Broker → Carrier (Tier 0) → Driver
              └─→ Carrier (Tier 1) → Driver
```

**API Example:**
```bash
# Get carriers by tier for cascade tenders
GET /api/parties/{brokerId}/carriers-by-tier
```

### 2. Stage Pipeline

Shipment stages with dependencies:

```
Pickup → Transit → Delivery
   ↓        ↓        ↓
  [Dependencies managed automatically]
```

**API Example:**
```bash
# Advance stage (checks dependencies)
POST /api/shipments/{id}/stages/advance
{
  "stageId": "stage-uuid",
  "force": false
}
```

### 3. Settlement Chain

Multi-link payment flows:

```
Shipper → Broker (DIRECT)
Broker → Carrier (SHARE 90%)
Carrier → Driver (SHARE 50%)
```

**API Example:**
```bash
# Get settlement chain
GET /api/settlements/chain/{chainId}?includeDetails=true
```

### 4. Cascade Tenders

Tiered tender process:

```
Sequential Mode:
Tier 0 → [fails] → Tier 1 → [fails] → Tier 2

Parallel Mode:
Tier 0 + Tier 1 + Tier 2 (simultaneously)
```

**API Example:**
```bash
# Create cascade tender
POST /api/tenders/cascade?brokerId={id}
{
  "orderId": "order-uuid",
  "mode": "SEQUENTIAL",
  "tiers": [
    {
      "tier": 0,
      "carrierIds": ["carrier1", "carrier2"],
      "offerDeadlineMinutes": 60
    }
  ]
}
```

## 🔌 Plugin Development

### Basic Plugin Structure

```typescript
import { Plugin, ApiHandler, EventHandler } from '@tms/plugin-sdk';

export default class MyPlugin extends Plugin {
  @ApiHandler('/my-endpoint', 'GET')
  async handleRequest(req) {
    return { status: 200, body: { message: 'Hello from plugin!' } };
  }

  @EventHandler('com.tms.shipment.delivered')
  async onShipmentDelivered(event) {
    // Custom logic when shipment is delivered
    console.log('Shipment delivered:', event.data.shipmentId);
  }
}
```

### Plugin Manifest (plugin.json)

```json
{
  "id": "my-plugin",
  "name": "My Custom Plugin",
  "version": "1.0.0",
  "main": "dist/index.js",
  "capabilities": {
    "apis": [
      { "path": "/my-endpoint", "method": "GET", "handler": "handleRequest" }
    ],
    "events": [
      { "eventType": "com.tms.shipment.delivered", "handler": "onShipmentDelivered" }
    ]
  }
}
```

### Plugin Management

```bash
# Register plugin
POST /api/plugins/register
{ "pluginPath": "/path/to/plugin" }

# Enable plugin
PATCH /api/plugins/{pluginId}/enable
{ "config": { "key": "value" } }

# Disable plugin
PATCH /api/plugins/{pluginId}/disable
```

## 🏗 Architecture

### Kernel Services

- **EventBus**: CloudEvents-based event system
- **ContractService**: Zod/AJV validation
- **HookService**: Plugin lifecycle hooks
- **PluginRuntimeService**: Plugin execution

### Domain Modules

- **Parties**: Entity and relationship management
- **Orders**: Order lifecycle and items
- **Shipments**: Stage pipeline management
- **Tenders**: Cascade tender system
- **Settlements**: Payment chain processing

### Plugin Capabilities

- **APIs**: Custom REST endpoints
- **Events**: CloudEvents subscription
- **Hooks**: Lifecycle interception
- **UI Slots**: Web app integration
- **Workflows**: Automation rules

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run API tests
pnpm --filter @tms/api test

# Run contract tests
pnpm --filter @tms/contracts test

# E2E tests
pnpm --filter @tms/api test:e2e
```

## 📚 API Documentation

Once running, visit:
- API Docs: http://localhost:3000/api/docs
- Web App: http://localhost:3001

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- Documentation: `/docs`
- API Reference: `/api/docs`
- Issues: GitHub Issues
- Discussions: GitHub Discussions
