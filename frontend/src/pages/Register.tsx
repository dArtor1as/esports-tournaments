import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

// 1. ІМПОРТУЄМО БІБЛІОТЕКУ КРАЇН
import countries from 'i18n-iso-countries';
// 2. ІМПОРТУЄМО УКРАЇНСЬКУ МОВУ (обов'язково вказуємо type-only або звичайний залежно від налаштувань, тут звичайний)
import ukLocale from 'i18n-iso-countries/langs/uk.json';

// 3. РЕЄСТРУЄМО МОВУ В БІБЛІОТЕЦІ
countries.registerLocale(ukLocale);

// 4. ГЕНЕРУЄМО ПОВНИЙ СПИСОК КРАЇН УКРАЇНСЬКОЮ
const REGIONS_COUNTRIES = Object.entries(
  countries.getNames('uk', { select: 'official' }),
)
  .map(([code, name]) => ({
    code: code.toUpperCase(),
    name: name,
  }))
  .sort((a, b) => a.name.localeCompare(b.name)); // Сортуємо за алфавітом від А до Я

// Додамо кастомний пункт "Міжнародний" на початок, якщо він тобі потрібен для кіберспорту
REGIONS_COUNTRIES.unshift({ code: 'INT', name: 'Міжнародний' });

export default function Register() {
  // Весь твій код стану (useState) та функція handleRegister залишаються АБСОЛЮТНО без змін!
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload: any = {
        username: username.trim(),
        email: email.trim(),
        password,
      };

      if (countryCode) payload.countryCode = countryCode;
      if (birthDate) payload.birthDate = new Date(birthDate).toISOString();

      await api.post('/users', payload);
      toast.success('Акаунт успішно створено! Тепер ви можете увійти.');
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Помилка при створенні акаунта');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[75vh] animate-in fade-in duration-500 py-10">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-white shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-black text-esports-accent tracking-wide">
            Приєднатися до CyberBracket
          </CardTitle>
          <CardDescription className="text-slate-400">
            Заповніть профіль, щоб брати участь у турнірах.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            {/* ... твої інпути логіну та емейлу ... */}
            <div className="space-y-2">
              <Label htmlFor="username">Ігровий логін (Username) *</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Наприклад: s1mple"
                className="bg-slate-950 border-slate-800 focus-visible:ring-esports-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="player@esports.com"
                className="bg-slate-950 border-slate-800 focus-visible:ring-esports-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Країна</Label>
                {/* 5. НАШ СЕЛЕКТ ТЕПЕР ПРАЦЮЄ НА ОБКРУТЦІ З 250+ КРАЇН СВІТУ */}
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 focus:ring-esports-primary">
                    <SelectValue placeholder="Оберіть..." />
                  </SelectTrigger>
                  {/* Додамо макс. висоту для випадаючого списку, щоб він не розтягувався на весь екран */}
                  <SelectContent className="bg-slate-800 border-slate-700 text-white max-h-64 overflow-y-auto">
                    {REGIONS_COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Дата народження</Label>
                <Input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="bg-slate-950 border-slate-800 focus-visible:ring-esports-primary block w-full"
                />
              </div>
            </div>

            {/* ... інпут паролю та кнопка реєстрації ... */}
            <div className="space-y-2">
              <Label htmlFor="password">Пароль *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Мінімум 6 symbols"
                  className="bg-slate-950 border-slate-800 pr-10 focus-visible:ring-esports-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-esports-accent transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm font-medium">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-esports-primary hover:bg-esports-primary/90 text-white font-bold tracking-wider mt-4"
            >
              {loading ? 'Створення...' : 'Створити акаунт'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            Вже є акаунт?{' '}
            <Link
              to="/login"
              className="text-esports-accent hover:underline font-bold"
            >
              Увійти
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
