import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { PlusCircle, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { db } from '../firebase.ts';
import { collection, addDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { Question } from '../data/mockData.ts';

export function AddQuestion() {
  const { userInfo } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>(); // For editing

  const [formData, setFormData] = useState<Partial<Question>>({
    title: '',
    subject: '',
    topic: '',
    question_html: '',
    explanation_html: '',
    options: [
      { label: 'A', text_html: '', is_correct: true },
      { label: 'B', text_html: '', is_correct: false },
      { label: 'C', text_html: '', is_correct: false },
      { label: 'D', text_html: '', is_correct: false },
    ],
    difficulty: 'Medium',
    year: new Date().getFullYear().toString(),
    tags: [],
    question_type: 'mcq',
    verified: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    if (id) {
        setIsEditMode(true);
        const fetchQuestion = async () => {
            setLoading(true);
            const docRef = doc(db, 'questions', id);
            const docSnap = await getDoc(docRef);
            if(docSnap.exists()){
                const questionData = docSnap.data() as Question;
                // Ensure options are initialized correctly
                if (!questionData.options || questionData.options.length === 0) {
                    questionData.options = [
                        { label: 'A', text_html: '', is_correct: true },
                        { label: 'B', text_html: '', is_correct: false },
                        { label: 'C', text_html: '', is_correct: false },
                        { label: 'D', text_html: '', is_correct: false },
                    ];
                }
                // Ensure at least one option is correct for MCQ on load if none are
                if (questionData.question_type === 'mcq' && !questionData.options.some((o: { is_correct: boolean }) => o.is_correct)) {
                    questionData.options[0].is_correct = true;
                }
                setFormData(questionData);
            } else {
                setError("Question not found");
            }
            setLoading(false);
        };
        fetchQuestion();
    }
  }, [id]);

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...(formData.options || [])];
    newOptions[index].text_html = value;
    setFormData({ ...formData, options: newOptions });
  };

  // MODIFIED: Handler for MCQ (radio button)
  const handleCorrectOptionChange = (index: number) => {
    const newOptions = (formData.options || []).map((opt: { label: string, text_html: string, is_correct: boolean }, i: number) => ({
      ...opt,
      is_correct: i === index,
    }));
    setFormData({ ...formData, options: newOptions });
  };

  // MODIFIED: Handler for MSQ (checkbox)
  const handleCorrectOptionToggle = (index: number) => {
    const newOptions = (formData.options || []).map((opt: { label: string, text_html: string, is_correct: boolean }, i: number) => ({
      ...opt,
      is_correct: i === index ? !opt.is_correct : opt.is_correct,
    }));
    setFormData({ ...formData, options: newOptions });
  };
  
  // MODIFIED: Handle question type change
  const handleTypeChange = (type: 'mcq' | 'nat' | 'msq') => {
      const newOptions = (formData.options || []).map((opt: { label: string, text_html: string, is_correct: boolean }, i: number) => ({
          ...opt,
          // When switching to MCQ, default to A being correct if nothing else is
          is_correct: type === 'mcq' ? i === 0 : false
      }));
      setFormData({
          ...formData,
          question_type: type,
          options: newOptions,
          nat_answer: type === 'nat' ? formData.nat_answer : '', // Clear NAT answer if not NAT
          correctAnswerLabel: type === 'mcq' ? newOptions.find((o: { is_correct: boolean }) => o.is_correct)?.label : null,
          correctAnswerLabels: type === 'msq' ? [] : []
      });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInfo || (userInfo.role !== 'moderator' && userInfo.role !== 'admin')) {
      setError('You are not authorized to perform this action.');
      return;
    }
    setLoading(true);
    setError('');

    try {
        // MODIFIED: Handle saving correct answer labels based on type
        const questionData = {
            ...formData,
            addedBy: userInfo.uid,
            createdAt: new Date().toISOString(),
            verified: userInfo.role === 'admin' ? true : false, // Admins can auto-verify
            // Handle single vs multiple correct labels
            correctAnswerLabel: formData.question_type === 'mcq'
                ? formData.options?.find((opt: { is_correct: boolean }) => opt.is_correct)?.label || 'A' // Default to A if none selected
                : null, // Clear single label for MSQ/NAT
            correctAnswerLabels: formData.question_type === 'msq'
                ? formData.options?.filter((opt: { is_correct: boolean }) => opt.is_correct).map((opt: { label: string }) => opt.label) || []
                : [], // Clear array for MCQ/NAT
        };

        if (isEditMode && id) {
            await setDoc(doc(db, 'questions', id), questionData);
        } else {
            await addDoc(collection(db, 'questions'), questionData);
        }
      
      navigate('/admin');
    } catch (err) {
      console.error(err);
      setError('Failed to save question. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEditMode) {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/admin" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6">
          <ArrowLeft className="w-5 h-5" />
          Back to Panel
        </Link>
        <h1 className="text-3xl font-bold mb-6">{isEditMode ? 'Edit Question' : 'Add a New Question'}</h1>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-900 p-8 rounded-lg shadow-md">
          {/* Form fields for question properties */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
            <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subject</label>
                <input type="text" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500"/>
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Topic</label>
                <input type="text" value={formData.topic} onChange={e => setFormData({...formData, topic: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500"/>
             </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Question (HTML)</label>
            <textarea value={formData.question_html} onChange={e => setFormData({...formData, question_html: e.target.value})} rows={5} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500"/>
          </div>

          {/* Options for MCQ */}
          {formData.question_type === 'mcq' && (
            <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Options (Select one correct answer)</label>
                {(formData.options || []).map((opt: { label: string, text_html: string, is_correct: boolean }, index: number) => (
                    <div key={index} className="flex items-center gap-4">
                        <input type="radio" name="correct_option" checked={opt.is_correct} onChange={() => handleCorrectOptionChange(index)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"/>
                        <span className="font-semibold">{opt.label}</span>
                        <input type="text" placeholder={`Option ${opt.label} HTML`} value={opt.text_html} onChange={e => handleOptionChange(index, e.target.value)} className="flex-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500"/>
                    </div>
                ))}
            </div>
          )}

          {/* MODIFIED: Options for MSQ */}
          {formData.question_type === 'msq' && (
            <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Options (Mark all that are correct)</label>
                {(formData.options || []).map((opt: { label: string, text_html: string, is_correct: boolean }, index: number) => (
                    <div key={index} className="flex items-center gap-4">
                        <input type="checkbox" name={`correct_option_${index}`} checked={opt.is_correct} onChange={() => handleCorrectOptionToggle(index)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"/>
                        <span className="font-semibold">{opt.label}</span>
                        <input type="text" placeholder={`Option ${opt.label} HTML`} value={opt.text_html} onChange={e => handleOptionChange(index, e.target.value)} className="flex-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500"/>
                    </div>
                ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Explanation (HTML)</label>
            <textarea value={formData.explanation_html} onChange={e => setFormData({...formData, explanation_html: e.target.value})} rows={5} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500"/>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Difficulty</label>
                <select value={formData.difficulty} onChange={e => setFormData({...formData, difficulty: e.target.value as 'Easy' | 'Medium' | 'Hard'})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500">
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Year</label>
                <input type="text" value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Question Type</label>
                {/* MODIFIED: Added onChange handler */}
                <select 
                    value={formData.question_type} 
                    onChange={e => handleTypeChange(e.target.value as 'mcq' | 'nat' | 'msq')} 
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500"
                >
                    <option value="mcq">MCQ</option>
                    <option value="nat">NAT</option>
                    <option value="msq">MSQ</option>
                </select>
            </div>
          </div>
          {formData.question_type === 'nat' && (
             <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">NAT Answer</label>
                <input type="text" value={formData.nat_answer || ''} onChange={e => setFormData({...formData, nat_answer: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500"/>
             </div>
          )}


          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="animate-spin" /> : <PlusCircle />}
            {isEditMode ? 'Update Question' : 'Add Question'}
          </button>
        </form>
      </div>
    </div>
  );
}



