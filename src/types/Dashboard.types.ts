export interface DashboardData {
  topCards: {
    todayBookedRooms: number;
    pendingRooms: number;
    availableRooms: number;
    totalRevenue: number;
  };

  roomsByType: {
    type: string;
    _count: { _all: number };
  }[];

  roomStatus: {
    booked: number;
    available: number;
  };

  bookingOverview: {
    month: string;
    count: number;
  }[];

  recentReviews: {
    rating: number;
    comment: string;
    user: { name: string };
  }[];
}
