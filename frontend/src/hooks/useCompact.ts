import { useWriteContract, useChainId } from 'wagmi'
import { COMPACT_ABI, COMPACT_ADDRESS, isSupportedChain } from '../../src/constants/contracts'
import { useNotification } from '../context/NotificationContext'

interface NativeDeposit {
  allocator: `0x${string}`
  value: bigint
  isNative: true
}

interface TokenDeposit {
  token: `0x${string}`
  allocator: `0x${string}`
  amount: bigint
  isNative: false
}

type DepositParams = NativeDeposit | TokenDeposit

interface WithdrawalParams {
  args: readonly [bigint] | readonly [bigint, `0x${string}`, bigint]
}

export function useCompact() {
  const chainId = useChainId()
  const { writeContract } = useWriteContract()
  const { showNotification } = useNotification()

  const deposit = async (params: DepositParams) => {
    if (!isSupportedChain(chainId)) {
      throw new Error('Unsupported chain')
    }

    try {
      const hash = await writeContract({
        address: COMPACT_ADDRESS as `0x${string}`,
        abi: COMPACT_ABI,
        functionName: 'deposit',
        args: params.isNative 
          ? [params.allocator]
          : [params.token, params.allocator, params.amount],
        value: params.isNative ? params.value : 0n,
      })

      showNotification({
        type: 'success',
        title: 'Transaction Submitted',
        message: 'Your deposit transaction has been submitted.',
      })

      return hash
    } catch (error) {
      console.error('Deposit error:', error)
      showNotification({
        type: 'error',
        title: 'Transaction Failed',
        message: error instanceof Error ? error.message : 'Failed to submit transaction',
      })
      throw error
    }
  }

  const enableForcedWithdrawal = async (params: WithdrawalParams) => {
    if (!isSupportedChain(chainId)) {
      throw new Error('Unsupported chain')
    }

    try {
      const hash = await writeContract({
        address: COMPACT_ADDRESS as `0x${string}`,
        abi: COMPACT_ABI,
        functionName: 'enableForcedWithdrawal',
        args: params.args as [bigint],
      })

      return hash
    } catch (error) {
      console.error('Enable forced withdrawal error:', error)
      throw error
    }
  }

  const disableForcedWithdrawal = async (params: WithdrawalParams) => {
    if (!isSupportedChain(chainId)) {
      throw new Error('Unsupported chain')
    }

    try {
      const hash = await writeContract({
        address: COMPACT_ADDRESS as `0x${string}`,
        abi: COMPACT_ABI,
        functionName: 'disableForcedWithdrawal',
        args: params.args as [bigint],
      })

      return hash
    } catch (error) {
      console.error('Disable forced withdrawal error:', error)
      throw error
    }
  }

  const forcedWithdrawal = async (params: WithdrawalParams) => {
    if (!isSupportedChain(chainId)) {
      throw new Error('Unsupported chain')
    }

    try {
      const hash = await writeContract({
        address: COMPACT_ADDRESS as `0x${string}`,
        abi: COMPACT_ABI,
        functionName: 'forcedWithdrawal',
        args: params.args as [bigint, `0x${string}`, bigint],
      })

      return hash
    } catch (error) {
      console.error('Forced withdrawal error:', error)
      throw error
    }
  }

  return {
    deposit,
    enableForcedWithdrawal,
    disableForcedWithdrawal,
    forcedWithdrawal,
    isSupported: isSupportedChain(chainId),
  }
}
