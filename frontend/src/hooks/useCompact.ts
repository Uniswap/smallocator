import { useWriteContract, useSimulateContract, useWatchContractEvent } from 'wagmi'
import { parseEther, parseUnits } from 'viem'
import { COMPACT_ABI, COMPACT_ADDRESS } from '../constants/contracts'

interface DepositParams {
  args: any[]
  value?: bigint
  isNative?: boolean
}

export function useCompact() {
  const { writeContract } = useWriteContract()

  const deposit = async ({ args, value = 0n, isNative = true }: DepositParams) => {
    try {
      const hash = await writeContract({
        address: COMPACT_ADDRESS as `0x${string}`,
        abi: COMPACT_ABI,
        functionName: 'deposit',
        args,
        value,
      })
      return hash
    } catch (error) {
      console.error('Deposit error:', error)
      throw error
    }
  }

  return {
    deposit,
  }
}
