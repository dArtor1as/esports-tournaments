import { useState } from 'react';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';

interface DeleteConfirmationZoneProps {
  entityType: 'USER' | 'PLAYER';
  entityName: string;
  requireCode: boolean;
  isProcessing: boolean;
  error: string;
  onCancel: () => void;
  onRequestCode?: () => Promise<void>;
  onConfirm: (code?: string) => Promise<void>;
}

export default function DeleteConfirmationZone({
  entityType,
  entityName,
  requireCode,
  isProcessing,
  error,
  onCancel,
  onRequestCode,
  onConfirm,
}: DeleteConfirmationZoneProps) {
  const [deleteChecked, setDeleteChecked] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const entityLabel = entityType === 'USER' ? 'акаунт' : 'ігровий профіль';

  const handleRequestCode = async () => {
    if (onRequestCode) {
      await onRequestCode();
      setCodeSent(true);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <DialogHeader>
        <DialogTitle className="text-red-500 flex items-center gap-2 text-xl">
          <AlertTriangle size={24} /> Небезпечна зона
        </DialogTitle>
      </DialogHeader>

      {!requireCode || !codeSent ? (
        <>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-200">
            Ви збираєтеся видалити {entityLabel} <strong>{entityName}</strong>.{' '}
            {entityType === 'USER'
              ? 'Усі персональні дані будуть знищені.'
              : 'Уся статистика залишиться, але профіль стане анонімним.'}{' '}
            <strong>Ця дія є абсолютно безповоротною.</strong>
          </div>

          <label className="flex items-start space-x-3 cursor-pointer p-2 hover:bg-slate-800/50 rounded-lg transition-colors">
            <Checkbox
              checked={deleteChecked}
              onCheckedChange={(c) => setDeleteChecked(!!c)}
              className="border-slate-500 data-[state=checked]:bg-red-600 mt-1"
            />
            <span className="text-sm text-slate-300 leading-tight">
              Я розумію наслідки і підтверджую незворотне видалення та
              анонімізацію.
            </span>
          </label>

          {error && (
            <p className="text-red-500 text-sm text-center font-bold">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 bg-transparent border-slate-700 hover:bg-slate-800"
              onClick={onCancel}
              disabled={isProcessing}
            >
              Скасувати
            </Button>
            <Button
              type="button"
              disabled={!deleteChecked || isProcessing}
              onClick={requireCode ? handleRequestCode : () => onConfirm()}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {isProcessing
                ? 'Обробка...'
                : requireCode
                  ? 'Отримати код'
                  : 'Видалити назавжди'}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-sm text-slate-200 text-center">
            Код відправлено на пошту! Введіть його нижче для остаточного
            видалення.
          </div>

          <div className="space-y-2">
            <Label>6-значний код підтвердження</Label>
            <Input
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="123456"
              className="bg-slate-900 border-red-500/50 text-white text-center text-xl tracking-widest"
              maxLength={6}
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center font-bold">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 bg-transparent border-slate-700 hover:bg-slate-800"
              onClick={() => {
                setCodeSent(false);
                setVerificationCode('');
              }}
            >
              Назад
            </Button>
            <Button
              type="button"
              disabled={verificationCode.length < 6 || isProcessing}
              onClick={() => onConfirm(verificationCode)}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {isProcessing ? 'Видалення...' : 'Підтвердити видалення'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
