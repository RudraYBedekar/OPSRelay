export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AccessRequest {
  id: string;
  requesterMemberId: string;
  requesterName: string;
  ownerMemberId: string;
  status: AccessRequestStatus;
  message?: string;
  createdAt: string;
  respondedAt?: string;
}

export interface AccessGrant {
  viewerMemberId: string;
  createdAt: string;
}
