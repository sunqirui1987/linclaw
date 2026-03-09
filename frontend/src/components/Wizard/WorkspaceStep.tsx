import { FolderOpen } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'

interface WorkspaceStepProps {
  workspace: string
  onWorkspaceChange: (value: string) => void
  onNext: () => void
}

export function WorkspaceStep({ workspace, onWorkspaceChange, onNext }: WorkspaceStepProps) {
  return (
    <Card>
      <CardHeader
        title="Step 6: 设置工作目录"
        description="设置 OpenClaw 默认工作目录，保存时会自动创建。"
      />
      <CardContent className="space-y-4">
        <Input
          label="工作目录"
          value={workspace}
          placeholder="~/.openclaw/workspace"
          onChange={(event) => onWorkspaceChange(event.target.value)}
          leftIcon={<FolderOpen className="h-4 w-4" />}
          hint="建议使用默认目录，如需自定义请确保有写入权限。"
        />

        <div className="flex justify-end border-t border-gray-200 pt-4 dark:border-gray-700">
          <Button onClick={onNext} disabled={!workspace.trim()}>
            下一步
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
