import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getAirports } from '../services/api'
import { 
  Plane, 
  Calendar, 
  Users, 
  ArrowLeftRight,
  Search,
  MapPin
} from 'lucide-react'
import { format, addDays } from 'date-fns'

function Home() {
  const navigate = useNavigate()
  const [tripType, setTripType] = useState('roundTrip')
  const [searchData, setSearchData] = useState({
    from: '',
    to: '',
    date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    returnDate: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
    passengers: 1,
    flexibleDates: false,
    directOnly: false,
  })

  const { data: airportsData } = useQuery({
    queryKey: ['airports'],
    queryFn: getAirports,
  })
  const airports = airportsData?.data?.data?.airports || []

  const handleSearch = (e) => {
    e.preventDefault()
    const params = new URLSearchParams({
      from: searchData.from,
      to: searchData.to,
      date: searchData.date,
      passengers: searchData.passengers.toString(),
      flexibleDates: searchData.flexibleDates.toString(),
      directOnly: searchData.directOnly.toString(),
    })
    navigate(`/search?${params.toString()}`)
  }

  const swapAirports = () => {
    setSearchData(prev => ({
      ...prev,
      from: prev.to,
      to: prev.from,
    }))
  }

  return (
    <div className="relative">
      {/* Hero Section */}
      <div 
        className="h-[700px] bg-cover bg-center relative"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.5)), url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1920&q=80')`,
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
          <h1 className="text-5xl md:text-7xl font-bold text-white text-center mb-4">
            Widen Your World
          </h1>
          <p className="text-xl text-white/80 text-center mb-12">
            Discover new destinations with Turkish Airlines
          </p>

          {/* Search Form */}
          <div className="w-full max-w-5xl">
            <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8">
              {/* Trip Type Tabs */}
              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => setTripType('roundTrip')}
                  className={`px-4 py-2 rounded-full font-medium transition-colors ${
                    tripType === 'roundTrip'
                      ? 'bg-turkish-red text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Round Trip
                </button>
                <button
                  onClick={() => setTripType('oneWay')}
                  className={`px-4 py-2 rounded-full font-medium transition-colors ${
                    tripType === 'oneWay'
                      ? 'bg-turkish-red text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  One Way
                </button>
              </div>

              <form onSubmit={handleSearch}>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* From */}
                  <div className="md:col-span-3 relative">
                    <label className="block text-sm font-medium text-gray-500 mb-1">From</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <select
                        value={searchData.from}
                        onChange={(e) => setSearchData({ ...searchData, from: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-turkish-red focus:border-transparent appearance-none bg-white"
                        required
                      >
                        <option value="">Select city</option>
                        {airports.map((airport) => (
                          <option key={airport.id} value={airport.code}>
                            {airport.city} ({airport.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Swap Button */}
                  <div className="md:col-span-1 flex items-end justify-center pb-1">
                    <button
                      type="button"
                      onClick={swapAirports}
                      className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      <ArrowLeftRight size={20} className="text-gray-600" />
                    </button>
                  </div>

                  {/* To */}
                  <div className="md:col-span-3 relative">
                    <label className="block text-sm font-medium text-gray-500 mb-1">To</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <select
                        value={searchData.to}
                        onChange={(e) => setSearchData({ ...searchData, to: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-turkish-red focus:border-transparent appearance-none bg-white"
                        required
                      >
                        <option value="">Select city</option>
                        {airports.map((airport) => (
                          <option key={airport.id} value={airport.code}>
                            {airport.city} ({airport.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Departure Date */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-500 mb-1">Departure</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="date"
                        value={searchData.date}
                        onChange={(e) => setSearchData({ ...searchData, date: e.target.value })}
                        min={format(new Date(), 'yyyy-MM-dd')}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-turkish-red focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  {/* Passengers */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-500 mb-1">Passengers</label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <select
                        value={searchData.passengers}
                        onChange={(e) => setSearchData({ ...searchData, passengers: parseInt(e.target.value) })}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-turkish-red focus:border-transparent appearance-none bg-white"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                          <option key={n} value={n}>{n} {n === 1 ? 'Passenger' : 'Passengers'}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Search Button */}
                  <div className="md:col-span-1 flex items-end">
                    <button
                      type="submit"
                      className="w-full h-[50px] bg-turkish-red hover:bg-turkish-dark text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                      <Search size={20} />
                    </button>
                  </div>
                </div>

                {/* Options */}
                <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-gray-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={searchData.flexibleDates}
                      onChange={(e) => setSearchData({ ...searchData, flexibleDates: e.target.checked })}
                      className="w-4 h-4 text-turkish-red rounded focus:ring-turkish-red"
                    />
                    <span className="text-gray-600">Flexible dates (±3 days)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={searchData.directOnly}
                      onChange={(e) => setSearchData({ ...searchData, directOnly: e.target.checked })}
                      className="w-4 h-4 text-turkish-red rounded focus:ring-turkish-red"
                    />
                    <span className="text-gray-600">Direct flights only</span>
                  </label>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose Turkish Airlines?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-turkish-red/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plane className="text-turkish-red" size={32} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Fly to 340+ Destinations</h3>
              <p className="text-gray-600">Connect to more countries than any other airline</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-turkish-red/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="text-turkish-red" size={32} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Miles&Smiles</h3>
              <p className="text-gray-600">Earn miles on every flight and redeem for rewards</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-turkish-red/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="text-turkish-red" size={32} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Flexible Booking</h3>
              <p className="text-gray-600">Change your plans with no hassle</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
