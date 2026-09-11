interface PageHeaderProps {
    name: string;
}

const PageHeader = ({ name }: PageHeaderProps) => (
    <h1 className="text-3xl font-bold text-slate-900 mb-4">{name}</h1>
);

export default PageHeader;
