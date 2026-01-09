import { useQuery } from '@tanstack/react-query'
import { getFlights } from '../services/api'
import { Plane, Users, Calendar, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'

function StatCard({ title, value, icon: Icon, trend, color }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{value}</p>
          {trend && (
            <p className={`text-sm mt-2 flex items-center gap-1 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp size={16} className={trend < 0 ? 'rotate-180' : ''} />
              {Math.abs(trend)}% from last month
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="text-white" size={24} />
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  const { data: flightsData, isLoading } = useQuery({
    queryKey: ['flights'],
    queryFn: () => getFlights({ limit: 10 }),
  })

  const flights = flightsData?.data?.data?.flights || []
  const totalFlights = flightsData?.data?.data?.pagination?.total || 0

  const todayFlights = flights.filter(
    (f) => f.departure_date === format(new Date(), 'yyyy-MM-dd')
  ).length

  const totalCapacity = flights.reduce((sum, f) => sum + (f.total_capacity || 0), 0)
  const availableCapacity = flights.reduce((sum, f) => sum + (f.available_capacity || 0), 0)
  const occupancyRate = totalCapacity > 0 
    ? Math.round(((totalCapacity - availableCapacity) / totalCapacity) * 100) 
    : 0

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back! Here's your flight overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Flights"
          value={isLoading ? '...' : totalFlights}
          icon={Plane}
          color="bg-turkish-red"
          trend={12}
        />
        <StatCard
          title="Today's Flights"
          value={isLoading ? '...' : todayFlights}
          icon={Calendar}
          color="bg-blue-500"
        />
        <StatCard
          title="Total Capacity"
          value={isLoading ? '...' : totalCapacity.toLocaleString()}
          icon={Users}
          color="bg-green-500"
        />
        <StatCard
          title="Occupancy Rate"
          value={isLoading ? '...' : `${occupancyRate}%`}
          icon={TrendingUp}
          color="bg-purple-500"
          trend={5}
        />
      </div>

      {/* Recent Flights */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">Recent Flights</h2>
          <a href="/flights" className="text-turkish-red hover:underline font-medium">
            View all →
          </a>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-turkish-red"></div>
          </div>
        ) : flights.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No flights found. Add your first flight!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Flight</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Route</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Time</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Capacity</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {flights.slice(0, 5).map((flight) => (
                  <tr key={flight.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <span className="font-semibold text-gray-800">{flight.flight_code}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{flight.from_airport_code}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium">{flight.to_airport_code}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-600">
                      {format(new Date(flight.departure_date), 'MMM dd, yyyy')}
                    </td>
                    <td className="py-4 px-4 text-gray-600">
                      {flight.departure_time?.slice(0, 5)}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-turkish-red h-2 rounded-full"
                            style={{
                              width: `${((flight.total_capacity - flight.available_capacity) / flight.total_capacity) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">
                          {flight.available_capacity}/{flight.total_capacity}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          flight.status === 'SCHEDULED'
                            ? 'bg-green-100 text-green-700'
                            : flight.status === 'CANCELLED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {flight.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
