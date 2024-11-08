import { createClient } from '@vercel/edge-config';
import dotenv from 'dotenv';
import { VerificationCode } from '../lib/types';

dotenv.config({ path: '.env.local' });

async function convertCodes() {
  try {
    console.log('开始转换验证码...');
    
    console.log('检查环境变量...');
    console.log('EDGE_CONFIG:', process.env.EDGE_CONFIG ? '已设置' : '未设置');
    console.log('VERCEL_API_TOKEN:', process.env.VERCEL_API_TOKEN ? '已设置' : '未设置');
    
    if (!process.env.EDGE_CONFIG || !process.env.VERCEL_API_TOKEN) {
      throw new Error('请确保设置了 EDGE_CONFIG 和 VERCEL_API_TOKEN 环境变量');
    }

    const edgeConfigId = process.env.EDGE_CONFIG.match(/ecfg_[^?]+/)?.[0];
    console.log('Edge Config ID:', edgeConfigId);
    
    if (!edgeConfigId) {
      throw new Error('无效的 Edge Config URL');
    }

    console.log('创建 Edge Config 客户端...');
    const edgeConfig = createClient(process.env.EDGE_CONFIG);
    
    console.log('获取当前验证码列表...');
    const existingCodes = await edgeConfig.get<string[]>('verified-codes') || [];
    console.log(`找到 ${existingCodes.length} 个现有验证码`);

    // 只取前50个验证码
    const selectedCodes = existingCodes.slice(0, 50);
    const newCodes: VerificationCode[] = selectedCodes.map(code => ({
      code,
      usageCount: 0,
      isValid: true
    }));

    console.log(`准备更新 ${newCodes.length} 个验证码`);

    const response = await fetch(`https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`, {
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
            value: newCodes
          },
          {
            operation: 'delete',
            key: 'verified-codes'
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`更新失败: ${JSON.stringify(errorData)}`);
    }

    console.log('验证码转换成功！');
    console.log(`共转换了 ${newCodes.length} 个验证码`);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

convertCodes();