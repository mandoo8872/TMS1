import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold">🚛 TMS Kernel</h1>
          </div>
          <nav className="flex items-center space-x-6">
            <Link href="/dashboard" className="text-sm font-medium hover:text-blue-600">
              Dashboard
            </Link>
            <Link href="/orders" className="text-sm font-medium hover:text-blue-600">
              Orders
            </Link>
            <Link href="/shipments" className="text-sm font-medium hover:text-blue-600">
              Shipments
            </Link>
            <Link href="/tenders" className="text-sm font-medium hover:text-blue-600">
              Tenders
            </Link>
            <Link href="/settlements" className="text-sm font-medium hover:text-blue-600">
              Settlements
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-5xl font-bold mb-6">
              Transportation Management System
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              A modern, extensible TMS platform with plugin architecture. 
              Manage orders, shipments, tenders, and settlements with ease.
            </p>
            <div className="flex gap-4 justify-center">
              <Link 
                href="/dashboard"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Dashboard →
              </Link>
              <Link 
                href="/api"
                className="border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                API Documentation
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">Core Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-2xl mb-4">📦</div>
              <h4 className="font-semibold mb-2">Order Management</h4>
              <p className="text-gray-600 text-sm">
                Create and manage orders with multi-party support, 
                item tracking, and location management.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-2xl mb-4">🚛</div>
              <h4 className="font-semibold mb-2">Smart Shipments</h4>
              <p className="text-gray-600 text-sm">
                Track shipments with stage pipelines, dependencies, 
                and real-time status updates.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-2xl mb-4">📋</div>
              <h4 className="font-semibold mb-2">Cascade Tenders</h4>
              <p className="text-gray-600 text-sm">
                Multi-tier tender management with sequential and 
                parallel modes for optimal carrier selection.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-2xl mb-4">💰</div>
              <h4 className="font-semibold mb-2">Settlement Chains</h4>
              <p className="text-gray-600 text-sm">
                Complex settlement flows with pass-through, share, 
                and direct payment links.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* API Status */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-800 mb-2">
              ✅ API Server Status
            </h3>
            <p className="text-green-700">
              TMS Kernel API is running on <strong>http://localhost:3000</strong>
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div>📚 Health Check: <code className="bg-white px-2 py-1 rounded">GET /api/health</code></div>
              <div>📦 Orders: <code className="bg-white px-2 py-1 rounded">GET /api/orders</code></div>
              <div>🚛 Shipments: <code className="bg-white px-2 py-1 rounded">GET /api/shipments</code></div>
              <div>📋 Cascade Tenders: <code className="bg-white px-2 py-1 rounded">POST /api/tenders/cascade</code></div>
              <div>⚡ Stage Advance: <code className="bg-white px-2 py-1 rounded">POST /api/shipments/:id/stages/advance</code></div>
              <div>💰 Settlement Chain: <code className="bg-white px-2 py-1 rounded">GET /api/settlements/chain/:chainId</code></div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              © 2024 TMS Kernel. Built with strong contracts and flexible plugins.
            </p>
            <div className="flex space-x-6">
              <a href="/api" className="text-sm hover:text-blue-600">
                API Reference
              </a>
              <a href="https://github.com" className="text-sm hover:text-blue-600">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}