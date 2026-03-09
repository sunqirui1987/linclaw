import { CheckCircle2, CircleAlert, KeyRound } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'

interface ApiKeyStepProps {
  apiKey: string
  apiKeyValid: boolean | null
  isValidating: boolean
  onApiKeyChange: (value: string) => void
  onValidate: () => void
  onSkip: () => void
  onNext: () => void
}

export function ApiKeyStep({
  apiKey,
  apiKeyValid,
  isValidating,
  onApiKeyChange,
  onValidate,
  onSkip,
  onNext,
}: ApiKeyStepProps) {
  return (
    <Card>
      <CardHeader
        title="Step 4: 配置 API Key"
        description="填写 API Key 用于后续模型拉取与 AI 能力验证。"
      />
      <CardContent className="space-y-4">
        <Input
          type="password"
          label="API Key"
          placeholder="例如 sk-xxxxx"
          value={apiKey}
          onChange={(event) => onApiKeyChange(event.target.value)}
          leftIcon={<KeyRound className="h-4 w-4" />}
          hint="支持先跳过，稍后在 AI 配置页补充。"
        />

        {apiKeyValid === true && (
          <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>API Key 验证成功。</span>
          </div>
        )}

        {apiKeyValid === false && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
            <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>API Key 验证失败，请检查后重试。</span>
          </div>
        )}

        <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
          <Button onClick={onValidate} loading={isValidating} disabled={!apiKey.trim()}>
            验证 API Key
          </Button>
          <Button onClick={onSkip} variant="secondary" disabled={isValidating}>
            跳过
          </Button>
          <Button
            onClick={onNext}
            variant="outline"
            disabled={isValidating || (apiKey.trim().length > 0 && apiKeyValid !== true)}
          >
            下一步
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
