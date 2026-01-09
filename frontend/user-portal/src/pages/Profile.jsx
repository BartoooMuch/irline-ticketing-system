import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { getMilesTransactions, getProfile } from '../services/api'
import { Navigate } from 'react-router-dom'
import { User, Star, TrendingUp, TrendingDown, Calendar, Plane } from 'lucide-react'
import { format } from 'date-fns'
import { useEffect } from 'react'

function Profile() {
  const { user, member, updateMember } = useAuth()

  // Fetch and update member data
  const { data: profileData } = useQuery({
    queryKey: ['profile'],
    queryFn: () => getProfile(),
    enabled: !!user,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (profileData?.data?.data) {
      updateMember(profileData.data.data)
    }
  }, [profileData, updateMember])

  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ['milesTransactions'],
    queryFn: () => getMilesTransactions({ limit: 10 }),
    enabled: !!member,
    refetchOnWindowFocus: true,
  })

  // Use the most up-to-date member data
  const currentMember = profileData?.data?.data || member

  if (!user) {
    return <Navigate to="/login" />
  }

  const transactions = transactionsData?.data?.data?.transactions || []

  // Calculate tier progress
  const tierLevels = {
    CLASSIC: { min: 0, max: 25000, next: 'CLASSIC PLUS' },
    'CLASSIC PLUS': { min: 25000, max: 50000, next: 'ELITE' },
    ELITE: { min: 50000, max: 100000, next: 'ELITE PLUS' },
    'ELITE PLUS': { min: 100000, max: null, next: null },
  }
  
  const currentTier = currentMember?.tier || 'CLASSIC'
  const tierInfo = tierLevels[currentTier]
  const totalMiles = currentMember?.total_miles || 0
  const progressPercent = tierInfo?.max 
    ? Math.min(100, ((totalMiles - tierInfo.min) / (tierInfo.max - tierInfo.min)) * 100)
    : 100

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="card mb-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="w-20 h-20 bg-turkish-red rounded-full flex items-center justify-center">
                <span className="text-white text-3xl font-bold">
                  {member?.first_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              
              <div className="flex-1">
                <h1 className="text-2xl font-bold">
                  {currentMember ? `${currentMember.first_name} ${currentMember.last_name}` : user.email}
                </h1>
                {currentMember && (
                  <>
                    <p className="text-gray-500">{currentMember.email}</p>
                    <p className="text-turkish-red font-mono mt-1">
                      Member: {currentMember.member_number}
                    </p>
                  </>
                )}
              </div>
              
              {currentMember && (
                <div className="text-right">
                  <p className="text-sm text-gray-500">Available Miles</p>
                  <p className="text-4xl font-bold text-turkish-red">
                    {currentMember.available_miles?.toLocaleString() || 0}
                  </p>
                </div>
              )}
            </div>
          </div>

          {currentMember && (
            <>
              {/* Tier Status */}
              <div className="card mb-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Star className="text-turkish-red" />
                  Tier Status
                </h2>
                
                <div className="flex items-center gap-4 mb-4">
                  <span className={`px-4 py-2 rounded-lg font-bold ${
                    currentTier === 'ELITE PLUS' 
                      ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white'
                      : currentTier === 'ELITE'
                      ? 'bg-gradient-to-r from-gray-700 to-gray-900 text-white'
                      : currentTier === 'CLASSIC PLUS'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                      : 'bg-turkish-red text-white'
                  }`}>
                    {currentTier}
                  </span>
                  <span className="text-gray-500">
                    {currentMember.total_miles?.toLocaleString() || 0} total miles earned
                  </span>
                </div>

                {tierInfo?.next && (
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>{tierInfo.min.toLocaleString()} miles</span>
                      <span>{tierInfo.max?.toLocaleString()} miles</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-turkish-red h-3 rounded-full transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      {(tierInfo.max - totalMiles).toLocaleString()} miles to reach {tierInfo.next}
                    </p>
                  </div>
                )}
              </div>

              {/* Miles Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="card text-center">
                  <Star className="mx-auto text-turkish-red mb-2" size={32} />
                  <p className="text-3xl font-bold">{currentMember.total_miles?.toLocaleString() || 0}</p>
                  <p className="text-gray-500">Total Earned</p>
                </div>
                <div className="card text-center">
                  <TrendingUp className="mx-auto text-green-500 mb-2" size={32} />
                  <p className="text-3xl font-bold">{currentMember.available_miles?.toLocaleString() || 0}</p>
                  <p className="text-gray-500">Available</p>
                </div>
                <div className="card text-center">
                  <TrendingDown className="mx-auto text-orange-500 mb-2" size={32} />
                  <p className="text-3xl font-bold">
                    {((currentMember.total_miles || 0) - (currentMember.available_miles || 0)).toLocaleString()}
                  </p>
                  <p className="text-gray-500">Used</p>
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="card">
                <h2 className="text-xl font-bold mb-4">Recent Miles Activity</h2>
                
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-turkish-red"></div>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No transactions yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((tx) => (
                      <div 
                        key={tx.id} 
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            tx.transaction_type === 'CREDIT'
                              ? 'bg-green-100'
                              : 'bg-red-100'
                          }`}>
                            {tx.transaction_type === 'CREDIT' ? (
                              <TrendingUp className="text-green-600" size={20} />
                            ) : (
                              <TrendingDown className="text-red-600" size={20} />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{tx.description || tx.source}</p>
                            <p className="text-sm text-gray-500">
                              {format(new Date(tx.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <span className={`font-bold ${
                          tx.transaction_type === 'CREDIT'
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}>
                          {tx.transaction_type === 'CREDIT' ? '+' : '-'}
                          {tx.miles_amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {!currentMember && (
            <div className="card text-center py-12">
              <User className="mx-auto text-gray-300 mb-4" size={48} />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                You're not a Miles&Smiles member yet
              </h3>
              <p className="text-gray-500 mb-6">
                Join now to start earning miles and enjoy exclusive benefits!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Profile
