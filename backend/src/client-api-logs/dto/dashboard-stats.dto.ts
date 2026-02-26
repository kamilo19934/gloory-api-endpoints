export class RecentErrorDto {
  id: string;
  clientId: string;
  clientName: string;
  method: string;
  endpoint: string;
  statusCode: number;
  statusCategory: string;
  errorMessage: string | null;
  duration: number;
  createdAt: Date;
}

export class TopEndpointDto {
  endpoint: string;
  count: number;
}

export class TopClientDto {
  clientId: string;
  clientName: string;
  count: number;
}

export class DashboardStatsDto {
  connectedClients: number;
  totalClients: number;
  totalToday: number;
  successToday: number;
  clientErrorToday: number;
  serverErrorToday: number;
  successRate: number;
  avgResponseTime: number;
  topEndpoints: TopEndpointDto[];
  topClients: TopClientDto[];
  recentErrors: RecentErrorDto[];
}
