import { createClient } from '@vercel/edge-config';
import { VerificationCode, VerificationResponse, VerificationStatus } from './types';

export class VerificationService {
  private static readonly edgeConfig = createClient(process.env.EDGE_CONFIG!);
  private static readonly edgeConfigId = process.env.EDGE_CONFIG?.match(/ecfg_[^?]+/)?.[0];

  // 获取所有验证码 - 使用 edge-config 客户端读取
  static async getAllCodes(): Promise<VerificationCode[]> {
    try {
      const codes = await this.edgeConfig.get<VerificationCode[]>('verification-codes');
      return codes || [];
    } catch (error) {
      console.error('获取验证码失败:', error);
      throw error;
    }
  }

  // 验证码验证
  static async verifyCode(code: string): Promise<VerificationResponse> {
    try {
      console.log('开始验证码验证:', code);
      const codes = await this.getAllCodes();
      console.log('获取到的验证码列表长度:', codes.length);
      
      const codeData = codes.find(c => c.code === code);
      console.log('验证码查找结果:', codeData ? {
        code: codeData.code,
        isValid: codeData.isValid,
        usageCount: codeData.usageCount
      } : '未找到验证码');
      
      if (!codeData) {
        return { 
          success: false, 
          message: '验证码不存在',
          remainingUses: 0 
        };
      }

      if (!codeData.isValid) {
        return { 
          success: false, 
          message: '验证码已失效',
          remainingUses: 0 
        };
      }

      // 创建新的验证码列表，而不是修改原有对象
      const updatedCodes = codes.map(c => 
        c.code === code 
          ? { ...c, usageCount: c.usageCount + 1, isValid: false }
          : c
      );

      // 使用 Vercel API 更新
      if (!this.edgeConfigId) {
        throw new Error('无效的 Edge Config URL');
      }

      const response = await fetch(`https://api.vercel.com/v1/edge-config/${this.edgeConfigId}/items`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [
            {
              operation: 'upsert',
              key: 'verification-codes',
              value: updatedCodes
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('更新验证码状态失败:', errorData);
        throw new Error('更新验证码状态失败');
      }

      // 等待一小段时间确保更新生效
      await new Promise(resolve => setTimeout(resolve, 1000));

      return { 
        success: true, 
        message: '验证成功',
        code: codeData.code,
        remainingUses: 0
      };
    } catch (error) {
      console.error('验证过程发生错误:', error);
      throw error;
    }
  }
}


