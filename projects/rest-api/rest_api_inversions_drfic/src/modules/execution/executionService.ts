/**
 * T027: Execution Service with Assisted Orchestration
 * =====================================================
 * Orquestador de ejecucion asistida que valida aprobacion previa y delega a adaptador broker.
 * 
 * Funcionalidad:
 * - Validar que propuesta tenga aprobacion humana valida
 * - Delegar a adaptador broker segun instrumento/broker
 * - Manejar transiciones de estado (PENDING_EXECUTION -> EXECUTING -> FILLED/FAILED)
 * - Garantizar que sin aprobacion previa, ejecucion rechaza con error
 * - En caso de fallo, registrar y transicionar a PENDING_APPROVAL para nueva evaluacion
 * 
 * Mapeo: FR-004, FR-005, FR-009, PL-001, PL-010
 */

export type ProposalState = 
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'PENDING_EXECUTION'
  | 'EXECUTING'
  | 'FILLED'
  | 'FAILED'
  | 'CANCELLED';

export interface Proposal {
  proposalId: string;
  signalId: string;
  userId: string;
  broker: 'IBKR' | 'ALPACA';
  instrument: string;
  orderType: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  state: ProposalState;
  approvedBy?: string;
  approvedAt?: Date;
  executionAttempts: number;
  lastError?: string;
}

export interface ExecutionRequest {
  proposalId: string;
  userId: string;
  orderId?: string; // opcional, generado por broker
}

export interface ExecutionResult {
  executionId: string;
  proposalId: string;
  orderId: string;
  state: ProposalState;
  timestamp: Date;
  brokerResponse?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
}

export class ExecutionService {
  /**
   * Validar que la propuesta tenga aprobacion humana valida.
   * 
   * @throws Error si estado != APPROVED o aprobacion expirada
   */
  async validateApproval(proposal: Proposal): Promise<boolean> {
    if (proposal.state !== 'APPROVED') {
      throw new Error(
        `EXECUTION_BLOCKED: proposal state is ${proposal.state}, require APPROVED`
      );
    }

    if (!proposal.approvedAt) {
      throw new Error('EXECUTION_BLOCKED: proposal has no approval timestamp');
    }

    // Validar que aprobacion no haya expirado (ventana de 24h)
    const expirationWindow = 24 * 60 * 60 * 1000; // 24 horas en ms
    const now = new Date();
    if (now.getTime() - proposal.approvedAt.getTime() > expirationWindow) {
      throw new Error('APPROVAL_EXPIRED: proposal approval is older than 24h');
    }

    return true;
  }

  /**
   * Ejecutar propuesta aprobada contra broker correspondiente.
   * 
   * Flujo:
   * 1. Validar aprobacion
   * 2. Cambiar estado a PENDING_EXECUTION
   * 3. Invocar adaptador broker
   * 4. Si exito: FILLED, guardar orderId del broker
   * 5. Si fallo: registrar error, transicionar a PENDING_APPROVAL, permitir reintento tras nueva aprobacion
   * 
   * @throws Error si aprobacion invalida o broker devuelve error irrecuperable
   */
  async execute(request: ExecutionRequest, proposal: Proposal): Promise<ExecutionResult> {
    // Validar aprobacion previa
    await this.validateApproval(proposal);

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // FIC: Implementacion futura: cambiar estado a PENDING_EXECUTION en Supabase
      // proposal.state = 'PENDING_EXECUTION';

      // FIC: Implementacion futura: seleccionar adaptador segun broker
      // const adapter = this.getBrokerAdapter(proposal.broker);
      // const brokerResponse = await adapter.submitOrder(proposal);

      // Por ahora, stub que retorna success
      const orderId = request.orderId || `order_${Date.now()}`;

      return {
        executionId,
        proposalId: request.proposalId,
        orderId,
        state: 'FILLED',
        timestamp: new Date(),
        brokerResponse: {
          status: 'success',
          orderId,
        },
      };
    } catch (error) {
      // En caso de fallo, registrar y retornar a PENDING_APPROVAL
      const errorMessage = error instanceof Error ? error.message : String(error);

      // FIC: Implementacion futura: transaccional con Supabase
      // - Registrar error
      // - Incrementar executionAttempts
      // - Transicionar a PENDING_APPROVAL para nueva evaluacion
      // - Emitir evento EXECUTION_FAILED a auditoria

      return {
        executionId,
        proposalId: request.proposalId,
        orderId: '',
        state: 'FAILED',
        timestamp: new Date(),
        errorCode: 'BROKER_ERROR',
        errorMessage,
      };
    }
  }

  /**
   * Obtener adaptador broker segun tipo.
   * 
   * FIC: Implementacion futura: inyectar adaptadores registrados
   */
  private getBrokerAdapter(broker: 'IBKR' | 'ALPACA') {
    // placeholder
    return null;
  }

  /**
   * Registrar transicion de estado para auditoria.
   * 
   * FIC: Implementacion futura: emitir evento a auditoria con campos minimos:
   * - event_id, timestamp_utc, correlation_id
   * - proposal_id, user_id, action_type
   * - previous_state, new_state
   * - broker, instrument, quantity
   */
  async registerStateTransition(
    proposalId: string,
    previousState: ProposalState,
    newState: ProposalState,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    // FIC: Stub. Implementar emision de evento a auditoria.
    console.log(`[Audit] Transition: ${previousState} -> ${newState} for proposal ${proposalId}`);
  }

  /**
   * Obtener propuesta actual con estado.
   * 
   * FIC: Implementacion futura: consultar Supabase
   */
  async getProposal(proposalId: string): Promise<Proposal | null> {
    // FIC: Stub.
    return null;
  }
}
