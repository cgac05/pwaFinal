/**
 * T026: Approval Service with MFA Validation
 * ============================================
 * Servicio responsable de registrar aprobaciones/rechazos de propuestas operativas con validacion MFA.
 * 
 * Funcionalidad:
 * - Validar que MFA sea valido y requerido para trader/admin
 * - Registrar aprobacion/rechazo con campos de traza obligatorios
 * - Marcar transicion de PENDING_APPROVAL -> APPROVED / REJECTED
 * - Integrar con auditoria para eventos HUMAN_APPROVED / HUMAN_REJECTED
 * 
 * Mapeo: FR-004, FR-005, FR-019, PL-001, PL-006
 */

export interface MFAContext {
  mfaContextId: string;
  userId: string;
  timestamp: Date;
  method: 'totp' | 'sms' | 'hardware_key';
  verificationToken: string;
  expiresAt: Date;
}

export interface ApprovalRequest {
  proposalId: string;
  userId: string;
  role: 'viewer' | 'trader' | 'admin';
  action: 'approve' | 'reject';
  rationale?: string;
  mfaContext?: MFAContext;
}

export interface ApprovalResult {
  approvalId: string;
  proposalId: string;
  userId: string;
  action: 'approve' | 'reject';
  timestamp: Date;
  mfaValidated: boolean;
  transitionedTo: 'APPROVED' | 'REJECTED' | null;
  eventId: string; // Reference a audit event
}

export class ApprovalService {
  /**
   * Validar que MFA sea valido para la accion requerida.
   * 
   * Reglas:
   * - viewer: no requiere MFA (solo lectura)
   * - trader: requiere MFA valido para aprobacion
   * - admin: siempre requiere MFA valido
   * 
   * @throws Error si MFA es requerido pero invalido/expirado
   */
  async validateMFA(request: ApprovalRequest): Promise<boolean> {
    const mfaRequired = request.role === 'trader' || request.role === 'admin';

    if (!mfaRequired) {
      return true; // viewer no requiere MFA
    }

    if (!request.mfaContext) {
      throw new Error('MFA_REQUIRED: trader/admin must provide MFA context');
    }

    // Validar que MFA no haya expirado (en caso real: verificar con provider de MFA)
    const now = new Date();
    if (request.mfaContext.expiresAt < now) {
      throw new Error('MFA_EXPIRED: MFA context has expired');
    }

    // FIC: Implementacion futura: validar verificationToken contra proveedor de MFA
    // Por ahora asumir que el token fue verificado en el middleware
    return true;
  }

  /**
   * Registrar aprobacion de una propuesta operativa.
   * 
   * @param request ApprovalRequest con accion approve
   * @returns ApprovalResult con transicion confirmada
   */
  async approve(request: ApprovalRequest): Promise<ApprovalResult> {
    if (request.action !== 'approve') {
      throw new Error('INVALID_ACTION: action must be "approve"');
    }

    // Validar MFA
    const mfaValid = await this.validateMFA(request);

    // FIC: Implementacion futura: transaccional con Supabase
    // - Leer propuesta actual en base
    // - Validar estado es PENDING_APPROVAL
    // - Registrar approval record
    // - Transicionar a APPROVED
    // - Emitir evento HUMAN_APPROVED a auditoria

    const approvalId = `appr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      approvalId,
      proposalId: request.proposalId,
      userId: request.userId,
      action: 'approve',
      timestamp: new Date(),
      mfaValidated: mfaValid,
      transitionedTo: 'APPROVED',
      eventId,
    };
  }

  /**
   * Registrar rechazo de una propuesta operativa.
   * 
   * @param request ApprovalRequest con accion reject
   * @returns ApprovalResult con transicion confirmada
   */
  async reject(request: ApprovalRequest): Promise<ApprovalResult> {
    if (request.action !== 'reject') {
      throw new Error('INVALID_ACTION: action must be "reject"');
    }

    // Validar MFA si es requerido
    const mfaValid = await this.validateMFA(request);

    // FIC: Implementacion futura: transaccional con Supabase
    // - Leer propuesta actual en base
    // - Validar estado es PENDING_APPROVAL
    // - Registrar rejection record
    // - Transicionar a REJECTED
    // - Emitir evento HUMAN_REJECTED a auditoria

    const approvalId = `appr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      approvalId,
      proposalId: request.proposalId,
      userId: request.userId,
      action: 'reject',
      timestamp: new Date(),
      mfaValidated: mfaValid,
      transitionedTo: 'REJECTED',
      eventId,
    };
  }

  /**
   * Obtener historial de aprobaciones para una propuesta.
   * 
   * FIC: Implementacion futura: consultar Supabase con filtro proposal_id
   */
  async getApprovalHistory(proposalId: string): Promise<ApprovalResult[]> {
    // FIC: Stub. Implementar consulta a Supabase.
    return [];
  }
}
